package com.dairy.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Reads our milk collections from the society's AMCS server - the same call the Member AMCS
 * phone app makes. The login identity (token, device id, IMEI, ...) travels in the JSON body;
 * there is no auth header. The values come from the AMCS_* environment settings.
 */
@Component
public class AmcsClient {

    /** AMCS refused our login: the token has expired or been replaced. Needs fresh credentials. */
    public static class AmcsAuthException extends RuntimeException {
        public AmcsAuthException(String message) { super(message); }
    }

    /** AMCS could not be reached or answered with something unusable. Usually transient. */
    public static class AmcsUnavailableException extends RuntimeException {
        public AmcsUnavailableException(String message) { super(message); }
        public AmcsUnavailableException(String message, Throwable cause) { super(message, cause); }
    }

    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    @Value("${amcs.url}") private String url;
    @Value("${amcs.token:}") private String token;
    @Value("${amcs.device-id:}") private String deviceId;
    @Value("${amcs.identity-code:}") private String identityCode;
    @Value("${amcs.imei:}") private String imei;
    @Value("${amcs.member-code:}") private String memberCode;
    @Value("${amcs.type:1}") private String type;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();

    public boolean isConfigured() {
        return notBlank(token) && notBlank(deviceId) && notBlank(identityCode)
            && notBlank(imei) && notBlank(memberCode);
    }

    /** The "data" rows for from..to inclusive, oldest first as AMCS returns them. */
    public List<Map<String, Object>> fetch(LocalDate from, LocalDate to) {
        if (!isConfigured()) {
            throw new AmcsAuthException("AMCS credentials are not configured (AMCS_TOKEN, AMCS_DEVICE_ID, "
                + "AMCS_IDENTITY_CODE, AMCS_IMEI, AMCS_MEMBER_CODE)");
        }

        Map<String, Object> content = new LinkedHashMap<>();
        content.put("fromDate", from + " 00:00:00.000000");
        content.put("toDate", to + " 23:59:59.000000");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("content", content);
        body.put("deviceId", deviceId);
        body.put("identityCode", identityCode);
        body.put("imei", imei);
        body.put("memberCode", memberCode);
        body.put("requestTime", LocalDate.now(ZONE).toString());
        body.put("token", token);
        body.put("type", type);

        HttpResponse<String> response;
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", "text/x-markdown; charset=utf-8")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();
            response = http.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new AmcsUnavailableException("AMCS request interrupted", ex);
        } catch (IOException ex) {
            throw new AmcsUnavailableException("AMCS unreachable: " + ex.getMessage(), ex);
        }

        int code = response.statusCode();
        if (code == 401 || code == 403) throw new AmcsAuthException("AMCS answered HTTP " + code);
        if (code / 100 != 2) throw new AmcsUnavailableException("AMCS answered HTTP " + code);

        return parse(response.body());
    }

    private List<Map<String, Object>> parse(String json) {
        JsonNode root;
        try {
            root = mapper.readTree(json);
        } catch (IOException ex) {
            throw new AmcsUnavailableException("AMCS sent something that is not JSON", ex);
        }

        String status = root.path("status").asText("");
        if (!"success".equalsIgnoreCase(status)) {
            String message = root.path("error").path("message").toString();
            // Observed for a bad token: {"status":"error","error":{"code":"","message":["Authentication Failed."]}}
            if (message.toLowerCase().contains("auth")) {
                throw new AmcsAuthException("AMCS refused the login token: " + message);
            }
            throw new AmcsUnavailableException("AMCS reported an error: status=" + status + " " + message);
        }

        JsonNode data = root.path("data");
        // AMCS sends "" (or {}) rather than [] when the range has no collections
        if (data.isMissingNode() || data.isNull() || (data.isTextual() && data.asText().isEmpty())
            || (data.isObject() && data.isEmpty())) {
            return List.of();
        }
        if (!data.isArray()) {
            throw new AmcsUnavailableException("Unexpected AMCS data shape: " + data.getNodeType());
        }
        return mapper.convertValue(data, new TypeReference<List<Map<String, Object>>>() {});
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
