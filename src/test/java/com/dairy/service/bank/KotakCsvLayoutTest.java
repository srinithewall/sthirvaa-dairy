package com.dairy.service.bank;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Kotak net banking's real CSV and PDF layouts (values made up). */
class KotakCsvLayoutTest {

    private static final String CSV = String.join("\n",
        "\"\",\"\",\"Account Statement\"",
        "\"SAMPLE FARMS PRIVATE LIMITED\"",
        "\"1 MAIN ROAD\",\"\",\"\",\"\",\"Account No.\",\"1234567890\"",
        "\"BANGALORE\",\"\",\"\",\"\",\"Period\",\"From 01/10/2026 To 31/10/2026\"",
        "",
        "\"Sl. No.\",\"Transaction Date\",\"Value Date\",\"Description\",\"Chq /Ref No.\",\"Amount\",\"Dr / Cr\",\"Balance\",\"Dr / Cr\"",
        "\"1\",\"05-10-2026 08:36:06\",\"05-10-2026\",\"NEFT KS00226278100000 RAVI  S O KRISHNA GOWDA\",\"NEFTINW-1700000001\",\"22,900.00\",\"CR\",\"1,95,137.12\",\"CR\"",
        "\"2\",\"06-10-2026 14:15:08\",\"06-10-2026\",\"MB: Sent NEFT/ RAMESH K/ CANARA / 059800000075\",\"000559000318\",\"20,000.00\",\"DR\",\"1,75,137.12\",\"CR\"",
        "\"3\",\"19-10-2026 08:46:54\",\"19-10-2026\",\"SentIMPS629200000469RAMESH K/CNRBX0758/KKBKTrans\",\"IMPS-629200000156\",\"40,000.00\",\"DR\",\"1,35,137.12\",\"CR\"",
        "\"4\",\"28-10-2026 12:01:09\",\"28-10-2026\",\"CHRG: IMPS TRANSACTION DATED ON 19-OCT-2026\",\"\",\"5.90\",\"DR\",\"1,35,131.22\",\"CR\"",
        "\"Closing Balance\",\"as on 31/10/2026 INR 1,35,131.22\"",
        "",
        "\"Important Note:\"",
        "\"CSV statement with value date is recommended to be used for reconciliation purposes.\"");

    @Test
    void theAmountsOwnDrCrDecidesTheDirectionNotTheBalances() {
        StatementFileParser.Parsed parsed = StatementFileParser.read(CSV.getBytes(StandardCharsets.UTF_8));
        List<KotakClient.StatementLine> lines = parsed.lines();

        assertEquals(4, lines.size(), "closing balance and notes are not transactions");
        assertTrue(lines.get(0).credit());
        assertFalse(lines.get(1).credit());
        assertFalse(lines.get(2).credit());
        assertFalse(lines.get(3).credit());
        assertEquals(22900.0, lines.get(0).amount());
        assertEquals(5.9, lines.get(3).amount());
        assertEquals(LocalDate.of(2026, 10, 19), lines.get(2).date());
        assertEquals("IMPS-629200000156", lines.get(2).ref());
        assertEquals("7890", parsed.accountLast4());
    }

    @Test
    void namesAreReadOutOfKotakNarrations() {
        assertEquals("RAVI KRISHNA GOWDA", BankFeedService.counterpartyOf("NEFT KS00226278100000 RAVI  S O KRISHNA GOWDA"));
        assertEquals("RAMESH", BankFeedService.counterpartyOf("MB: Sent NEFT/ RAMESH K/ CANARA / 059800000075"));
        assertEquals("RAMESH", BankFeedService.counterpartyOf("SentIMPS629200000469RAMESH K/CNRBX0758/KKBKTrans"));
        assertEquals("CHARGES", BankFeedService.modeOf("CHRG: IMPS TRANSACTION DATED ON 19-OCT-2026"));
        assertEquals("ONLINE", BankFeedService.modeOf("PG PURCHASING HEADPHONE AMAZON PAY INDIA PRI"));
    }

    @Test
    void thePdfIsFiledByThePeriodOnItsFirstPage() {
        BankStatementService.Details d = BankStatementService.details(
            "Account Statement\n01 Oct 2026 - 31 Oct 2026\nSAMPLE FARMS PRIVATE LIMITED\nAccount No. 1234567890\n", 4);

        assertEquals(LocalDate.of(2026, 10, 1), d.from());
        assertEquals(LocalDate.of(2026, 10, 31), d.to());
        assertEquals("7890", d.accountLast4());
        assertEquals(4, d.pages());
        assertThrows(IllegalArgumentException.class, () -> BankStatementService.details("an invoice", 1));
    }
}
