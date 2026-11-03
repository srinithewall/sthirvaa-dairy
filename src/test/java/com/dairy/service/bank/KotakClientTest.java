package com.dairy.service.bank;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** The statement reader must cope with the usual Indian bank API shapes until Kotak's own is confirmed. */
class KotakClientTest {

    private final KotakClient client = new KotakClient();

    @Test
    void readsSeparateDebitAndCreditColumns() {
        List<KotakClient.StatementLine> lines = client.parse("""
            {"status":"SUCCESS","data":{"accountNumber":"1234","transactions":[
              {"TxnDate":"05-11-2026","Narration":"UPI/RAMESH FEEDS/41/x","Debit":"18,250.00","Credit":"","Balance":"1,02,000.50","RefNo":"R1"},
              {"TxnDate":"06-11-2026","Narration":"NEFT INW-BAMUL","Debit":"","Credit":"62340","Balance":"164340.50","RefNo":"R2"}
            ]}}""");

        assertEquals(2, lines.size());
        KotakClient.StatementLine first = lines.get(0);
        assertEquals(LocalDate.of(2026, 11, 5), first.date());
        assertEquals(18250.0, first.amount());
        assertFalse(first.credit());
        assertEquals(102000.5, first.balance());
        assertEquals("R1", first.ref());
        assertTrue(lines.get(1).credit());
    }

    @Test
    void readsASignedAmountWithADrCrFlag() {
        List<KotakClient.StatementLine> lines = client.parse("""
            [{"transactionDate":"2026-11-05T10:15:00","description":"ATM CASH","amount":2000,"drCrIndicator":"D"},
             {"transactionDate":"05-Nov-2026","description":"INTEREST","amount":"35.20","drCrIndicator":"C"},
             {"transactionDate":"not a date","description":"junk","amount":1}]""");

        assertEquals(2, lines.size());
        assertFalse(lines.get(0).credit());
        assertEquals(2000.0, lines.get(0).amount());
        assertTrue(lines.get(1).credit());
        assertEquals(LocalDate.of(2026, 11, 5), lines.get(1).date());
    }

    @Test
    void anEmptyStatementIsNoLines() {
        assertTrue(client.parse("{\"status\":\"SUCCESS\",\"data\":[]}").isEmpty());
    }

    @Test
    void readsACsvDownloadedFromNetBanking() {
        String csv = "﻿Kotak Mahindra Bank\nAccount No.,XXXXXX1234\nPeriod,01-10-2026 to 31-10-2026\n\n"
            + "Sl. No.,Transaction Date,Value Date,Description,Chq / Ref No.,Withdrawal (Dr),Deposit (Cr),Balance\r\n"
            + "1,02-10-2026,02-10-2026,\"UPI/RAMESH FEEDS/41234/feed, Oct\",UPI-41234,\"18,250.00\",,\"1,02,000.50(Cr)\"\r\n"
            + "2,03-10-2026,03-10-2026,NEFT INW-BAMUL,N123,,62340.00,\"1,64,340.50(Cr)\"\n"
            + ",,,Closing balance,,,,\"1,64,340.50\"\n";

        List<KotakClient.StatementLine> lines = StatementFileParser.parseCsv(csv.getBytes(java.nio.charset.StandardCharsets.UTF_8));

        assertEquals(2, lines.size());
        assertEquals("UPI/RAMESH FEEDS/41234/feed, Oct", lines.get(0).narration());
        assertEquals(18250.0, lines.get(0).amount());
        assertFalse(lines.get(0).credit());
        assertEquals("UPI-41234", lines.get(0).ref());
        assertEquals(102000.5, lines.get(0).balance());
        assertTrue(lines.get(1).credit());
        assertEquals(62340.0, lines.get(1).amount());
    }
}
