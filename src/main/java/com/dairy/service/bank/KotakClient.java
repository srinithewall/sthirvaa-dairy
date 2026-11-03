package com.dairy.service.bank;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.util.*;

/**
 * Reads the farm's current account statement from Kotak API Banking (api.kotak.bank.in,
 * "Account Services"). Credentials come from the KOTAK_* environment settings, like AMCS.
 *
 * PROVISIONAL: Kotak only shares the exact statement request and response format after
 * registration on its developer portal. Until then this follows the common gateway shape -
 * OAuth2 client-credentials token, then a JSON POST of account and date range - and reads the
 * response leniently: it takes the first array of objects it finds and picks each field from a
 * list of likely names (see the *_KEYS below). Adjust the request body and key lists against the
 * sandbox once access is granted; nothing else in the bank feed depends on Kotak's format.
 */
@Component
public class KotakClient {

    /** Kotak refused our credentials. Needs the KOTAK_* settings fixed. */
    public static class KotakAuthException extends RuntimeException {
        public KotakAuthException(String message) { super(message); }
    }

    /** Kotak could not be reached or answered with something unusable. */
    public static class KotakUnavailableException extends RuntimeException {
        public KotakUnavailableException(String message) { super(message); }
        public KotakUnavailableException(String message, Throwable cause) { super(message, cause); }
    }

    /** One statement line, in Kotak-neutral form. amount is always positive. */
    public record StatementLine(String ref, LocalDate date, String narration, double amount,
                                boolean credit, Double balance) {}

    private static final List<String> REF_KEYS = List.of("transactionid", "txnid", "tranid", "transactionrefno",
        "referenceno", "refno", "referencenumber", "utr", "utrno", "chequerefno", "chqrefno");
    private static final List<String> DATE_KEYS = List.of("transactiondate", "txndate", "trandate", "postingdate",
        "postdate", "date", "valuedate");
    private static final List<String> NARRATION_KEYS = List.of("narration", "description", "transactiondescription",
        "particulars", "remarks", "txndescription", "trandescription");
    private static final List<String> AMOUNT_KEYS = List.of("amount", "txnamount", "transactionamount", "tranamount");
    private static final List<String> DEBIT_KEYS = List.of("debit", "debitamount", "withdrawal", "withdrawalamt",
        "withdrawalamount", "dramount", "dr");
    private static final List<String> CREDIT_KEYS = List.of("credit", "creditamount", "deposit", "depositamt",
        "depositamount", "cramount", "cr");
    private static final List<String> DRCR_KEYS = List.of("drcr", "drcrindicator", "crdr", "creditdebitflag",
        "debitcreditflag", "txntype", "transactiontype", "type");
    private static final List<String> BALANCE_KEYS = List.of("balance", "runningbalance", "closingbalance",
        "balanceamount", "availablebalance");

    private static final List<DateTimeFormatter> DATES = List.of(
        DateTimeFormatter.ISO_LOCAL_DATE,
        DateTimeFormatter.ofPattern("dd-MM-yyyy"),
        DateTimeFormatter.ofPattern("dd/MM/yyyy"),
        new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("dd-MMM-yyyy").toFormatter(Locale.ENGLISH),
        new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("dd MMM yyyy").toFormatter(Locale.ENGLISH),
        DateTimeFormatter.BASIC_ISO_DATE);

    @Value("${kotak.api.token-url:}") private String tokenUrl;
    @Value("${kotak.api.statement-url:}") private String statementUrl;
    @Value("${kotak.api.client-id:}") private String clientId;
    @Value("${kotak.api.client-secret:}") private String clientSecret;
    @Value("${kotak.api.account-number:}") private String accountNumber;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();

    private String accessToken;
    private Instant tokenExpiry = Instant.EPOCH;

    public boolean isConfigured() {
        return notBlank(tokenUrl) && notBlank(statementUrl) && notBlank(clientId)
            && notBlank(clientSecret) && notBlank(accountNumber);
    }

    /** Last four digits of the configured account, for display. Never the full number. */
    public String accountLast4() {
        String digits = accountNumber == null ? "" : accountNumber.replaceAll("\\D", "");
        return digits.length() >= 4 ? digits.substring(digits.length() - 4) : null;
    }

    /** Statement lines dated from..to inclusive. */
    public List<StatementLine> fetchStatement(LocalDate from, LocalDate to) {
        if (!isConfigured()) {
            throw new KotakAuthException("Kotak API is not set up (KOTAK_TOKEN_URL, KOTAK_STATEMENT_URL, "
                + "KOTAK_CLIENT_ID, KOTAK_CLIENT_SECRET, KOTAK_ACCOUNT_NUMBER)");
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("accountNumber", accountNumber);
        body.put("fromDate", from.toString());
        body.put("toDate", to.toString());

        HttpResponse<String> response = send(HttpRequest.newBuilder(URI.create(statementUrl))
            .timeout(Duration.ofSeconds(60))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + token())
            .POST(HttpRequest.BodyPublishers.ofString(json(body))));
        if (response.statusCode() == 401) {
            accessToken = null; // expired early; the next click fetches a fresh one
        }
        check(response, "statement");
        return parse(response.body());
    }

    private synchronized String token() {
        if (accessToken != null && Instant.now().isBefore(tokenExpiry)) return accessToken;
        String form = "grant_type=client_credentials"
            + "&client_id=" + URLEncoder.encode(clientId, StandardCharsets.UTF_8)
            + "&client_secret=" + URLEncoder.encode(clientSecret, StandardCharsets.UTF_8);
        HttpResponse<String> response = send(HttpRequest.newBuilder(URI.create(tokenUrl))
            .timeout(Duration.ofSeconds(30))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(form)));
        check(response, "token");
        JsonNode root = readJson(response.body());
        String token = root.path("access_token").asText("");
        if (token.isEmpty()) throw new KotakAuthException("Kotak issued no access token");
        long expiresIn = root.path("expires_in").asLong(300);
        accessToken = token;
        tokenExpiry = Instant.now().plusSeconds(Math.max(expiresIn - 30, 30));
        return token;
    }

    private HttpResponse<String> send(HttpRequest.Builder request) {
        try {
            return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new KotakUnavailableException("Kotak request interrupted", ex);
        } catch (IOException ex) {
            throw new KotakUnavailableException("Kotak unreachable: " + ex.getMessage(), ex);
        }
    }

    private static void check(HttpResponse<String> response, String what) {
        int code = response.statusCode();
        if (code == 401 || code == 403) throw new KotakAuthException("Kotak refused the " + what + " request (HTTP " + code + ")");
        if (code / 100 != 2) throw new KotakUnavailableException("Kotak " + what + " request failed (HTTP " + code + ")");
    }

    List<StatementLine> parse(String body) {
        JsonNode rows = firstObjectArray(readJson(body));
        return rows == null ? List.of() : parseRows(rows);
    }

    /**
     * Statement rows (API objects, or a downloaded file's rows keyed by its column headings) to
     * lines. Rows without a readable date or amount - totals, blank lines - are skipped.
     */
    static List<StatementLine> parseRows(Iterable<JsonNode> rows) {
        List<StatementLine> lines = new ArrayList<>();
        for (JsonNode row : rows) {
            Map<String, JsonNode> f = flatten(row);
            LocalDate date = parseDate(text(f, DATE_KEYS));
            if (date == null) continue;

            Double debit = number(f, DEBIT_KEYS);
            Double credit = number(f, CREDIT_KEYS);
            double amount;
            boolean isCredit;
            if (credit != null && credit > 0) {
                amount = credit; isCredit = true;
            } else if (debit != null && debit > 0) {
                amount = debit; isCredit = false;
            } else {
                Double signed = number(f, AMOUNT_KEYS);
                if (signed == null || signed == 0) continue;
                String flag = Optional.ofNullable(text(f, DRCR_KEYS)).orElse("").trim().toUpperCase();
                isCredit = flag.isEmpty() ? signed > 0 : flag.startsWith("C");
                amount = Math.abs(signed);
            }
            lines.add(new StatementLine(text(f, REF_KEYS), date, text(f, NARRATION_KEYS), amount,
                isCredit, number(f, BALANCE_KEYS)));
        }
        return lines;
    }

    /** Depth-first: the first array whose elements are objects - the transaction list. */
    private static JsonNode firstObjectArray(JsonNode node) {
        if (node == null) return null;
        if (node.isArray()) {
            if (!node.isEmpty() && node.get(0).isObject()) return node;
            for (JsonNode child : node) {
                JsonNode found = firstObjectArray(child);
                if (found != null) return found;
            }
            return null;
        }
        if (node.isObject()) {
            for (Iterator<JsonNode> it = node.elements(); it.hasNext(); ) {
                JsonNode found = firstObjectArray(it.next());
                if (found != null) return found;
            }
        }
        return null;
    }

    /** Field name (lower case, letters and digits only) to value, one level of nesting included. */
    private static Map<String, JsonNode> flatten(JsonNode row) {
        Map<String, JsonNode> out = new HashMap<>();
        row.fields().forEachRemaining(e -> {
            if (e.getValue().isObject()) {
                e.getValue().fields().forEachRemaining(n -> out.putIfAbsent(key(n.getKey()), n.getValue()));
            } else {
                out.put(key(e.getKey()), e.getValue());
            }
        });
        return out;
    }

    private static String key(String name) {
        return name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    /** The value under k, else under a field name starting with k ("withdrawal" finds "Withdrawal (Dr)"). */
    private static JsonNode field(Map<String, JsonNode> f, String k) {
        JsonNode v = f.get(k);
        if (v != null || k.length() < 4) return v;
        for (Map.Entry<String, JsonNode> e : f.entrySet()) {
            if (e.getKey().startsWith(k)) return e.getValue();
        }
        return null;
    }

    private static String text(Map<String, JsonNode> f, List<String> keys) {
        for (String k : keys) {
            JsonNode v = field(f, k);
            if (v != null && !v.isNull() && !v.asText().isBlank()) return v.asText().trim();
        }
        return null;
    }

    private static Double number(Map<String, JsonNode> f, List<String> keys) {
        for (String k : keys) {
            JsonNode v = field(f, k);
            if (v == null || v.isNull()) continue;
            if (v.isNumber()) return v.asDouble();
            // "1,02,000.50", "₹ 250", "1,500.00 (Cr)": keep the digits, the point and a leading minus
            String s = v.asText().trim().replaceAll("(?i)rs\\.|inr", "")
                .replaceAll("[^0-9.\\-]", "").replaceAll("(?<!^)-", "");
            if (s.isEmpty()) continue;
            try { return Double.parseDouble(s); } catch (NumberFormatException ignored) { }
        }
        return null;
    }

    private static LocalDate parseDate(String s) {
        if (s == null) return null;
        String day = s.trim().split("[T ](?=\\d{1,2}:)")[0]; // drop any time part
        for (DateTimeFormatter format : DATES) {
            try {
                return LocalDate.parse(day, format);
            } catch (RuntimeException ignored) { }
        }
        return null;
    }

    private JsonNode readJson(String body) {
        try {
            return mapper.readTree(body);
        } catch (IOException ex) {
            throw new KotakUnavailableException("Kotak sent something that is not JSON", ex);
        }
    }

    private String json(Object o) {
        try {
            return mapper.writeValueAsString(o);
        } catch (IOException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
