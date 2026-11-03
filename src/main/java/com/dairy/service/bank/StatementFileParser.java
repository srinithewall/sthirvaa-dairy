package com.dairy.service.bank;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Reads a statement downloaded from Kotak net banking as CSV. Bank exports start with account
 * details and end with totals, so the header is the first row naming a date column and a
 * narration column, and every row after it is read with KotakClient's own column matching.
 */
public final class StatementFileParser {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private StatementFileParser() { }

    /** A statement file read: its lines, and the account's last four digits when the file names it. */
    public record Parsed(List<KotakClient.StatementLine> lines, String accountLast4) {}

    public static List<KotakClient.StatementLine> parseCsv(byte[] bytes) {
        return read(bytes).lines();
    }

    public static Parsed read(byte[] bytes) {
        String text = new String(bytes, StandardCharsets.UTF_8);
        if (text.startsWith("﻿")) text = text.substring(1); // Excel's byte-order mark
        char delimiter = guessDelimiter(text);
        List<List<String>> rows = splitCsv(text, delimiter);

        int header = -1;
        for (int i = 0; i < rows.size() && header < 0; i++) {
            if (isHeader(rows.get(i))) header = i;
        }
        if (header < 0) {
            throw new IllegalArgumentException("No statement table found: expected a header row with a date and a "
                + "description/narration column");
        }
        List<String> names = rows.get(header);
        List<JsonNode> objects = new ArrayList<>();
        for (List<String> row : rows.subList(header + 1, rows.size())) {
            ObjectNode o = MAPPER.createObjectNode();
            for (int c = 0; c < names.size() && c < row.size(); c++) {
                String name = names.get(c).trim();
                // Kotak repeats "Dr / Cr": first for the amount, then for the balance. The first one counts.
                if (!name.isEmpty() && !o.has(name)) o.put(name, row.get(c).trim());
            }
            objects.add(o);
        }
        return new Parsed(KotakClient.parseRows(objects), accountLast4(rows.subList(0, header)));
    }

    /** From the details above the table: the cell after "Account No.". */
    private static String accountLast4(List<List<String>> preamble) {
        for (List<String> row : preamble) {
            for (int c = 0; c + 1 < row.size(); c++) {
                if (row.get(c).toLowerCase(Locale.ROOT).replaceAll("[^a-z]", "").equals("accountno")) {
                    String digits = row.get(c + 1).replaceAll("\\D", "");
                    return digits.length() >= 4 ? digits.substring(digits.length() - 4) : null;
                }
            }
        }
        return null;
    }

    private static boolean isHeader(List<String> row) {
        boolean date = false, narration = false;
        for (String cell : row) {
            String k = cell.toLowerCase(Locale.ROOT).replaceAll("[^a-z]", "");
            if (k.contains("date")) date = true;
            if (k.contains("narration") || k.contains("description") || k.contains("particulars") || k.contains("remarks")) {
                narration = true;
            }
        }
        return date && narration;
    }

    private static char guessDelimiter(String text) {
        String head = text.length() > 4000 ? text.substring(0, 4000) : text;
        long commas = head.chars().filter(ch -> ch == ',').count();
        long tabs = head.chars().filter(ch -> ch == '\t').count();
        long semis = head.chars().filter(ch -> ch == ';').count();
        if (tabs > commas && tabs >= semis) return '\t';
        if (semis > commas) return ';';
        return ',';
    }

    /** RFC 4180: quoted fields may hold the delimiter, newlines and doubled quotes. */
    static List<List<String>> splitCsv(String text, char delimiter) {
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (quoted) {
                if (ch == '"' && i + 1 < text.length() && text.charAt(i + 1) == '"') {
                    cell.append('"');
                    i++;
                } else if (ch == '"') {
                    quoted = false;
                } else {
                    cell.append(ch);
                }
            } else if (ch == '"') {
                quoted = true;
            } else if (ch == delimiter) {
                row.add(cell.toString());
                cell.setLength(0);
            } else if (ch == '\n' || ch == '\r') {
                if (ch == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') i++;
                row.add(cell.toString());
                cell.setLength(0);
                rows.add(row);
                row = new ArrayList<>();
            } else {
                cell.append(ch);
            }
        }
        if (cell.length() > 0 || !row.isEmpty()) {
            row.add(cell.toString());
            rows.add(row);
        }
        return rows;
    }
}
