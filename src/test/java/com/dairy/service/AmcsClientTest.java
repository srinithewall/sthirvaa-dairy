package com.dairy.service;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Runs AmcsClient against a real local HTTP server that answers the way the AMCS server was
 * observed to answer (including its odd "" for an empty range and its error for a bad token).
 */
class AmcsClientTest {

    private HttpServer server;
    private final AtomicReference<String> lastBody = new AtomicReference<>();
    private final AtomicReference<String> lastContentType = new AtomicReference<>();
    private volatile int status = 200;
    private volatile String response = "";
    private AmcsClient client;

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/webservice/v4/collection/collection-data", exchange -> {
            lastBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            lastContentType.set(exchange.getRequestHeaders().getFirst("Content-Type"));
            byte[] out = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json; charset=UTF-8");
            exchange.sendResponseHeaders(status, out.length);
            exchange.getResponseBody().write(out);
            exchange.close();
        });
        server.start();

        client = new AmcsClient();
        ReflectionTestUtils.setField(client, "url",
            "http://127.0.0.1:" + server.getAddress().getPort() + "/webservice/v4/collection/collection-data");
        ReflectionTestUtils.setField(client, "token", "TOKEN-1");
        ReflectionTestUtils.setField(client, "deviceId", "DEVICE-1");
        ReflectionTestUtils.setField(client, "identityCode", "0540129");
        ReflectionTestUtils.setField(client, "imei", "IMEI-1");
        ReflectionTestUtils.setField(client, "memberCode", "05401290327");
        ReflectionTestUtils.setField(client, "type", "1");
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    void sendsTheIdentityAndDateRangeAndParsesTheRows() {
        response = "{\"status\":\"success\",\"error\":{\"code\":200,\"message\":[]},\"data\":["
            + "{\"memberCode\":\"05401290327\",\"fat\":3,\"snf\":8.5,\"quantity\":21.9,\"amount\":711.75,"
            + "\"collectionDate\":\"2026-10-23 16:00:00.000000\",\"sampleNo\":14,\"shiftCode\":\"Evening\","
            + "\"clr\":29.6,\"rate\":32.5,\"isQualityAuto\":true,\"isQuantityAuto\":true,"
            + "\"updatedAt\":null,\"updatedBy\":null,\"animalTypeName\":\"Cow\"}]}";

        List<Map<String, Object>> rows = client.fetch(LocalDate.of(2026, 10, 17), LocalDate.of(2026, 10, 23));

        assertEquals(1, rows.size());
        assertEquals("Evening", rows.get(0).get("shiftCode"));
        assertEquals(21.9, ((Number) rows.get(0).get("quantity")).doubleValue(), 1e-9);

        String body = lastBody.get();
        assertTrue(body.contains("\"fromDate\":\"2026-10-17 00:00:00.000000\""), body);
        assertTrue(body.contains("\"toDate\":\"2026-10-23 23:59:59.000000\""), body);
        assertTrue(body.contains("\"token\":\"TOKEN-1\""), body);
        assertTrue(body.contains("\"deviceId\":\"DEVICE-1\""), body);
        assertTrue(body.contains("\"memberCode\":\"05401290327\""), body);
        assertEquals("text/x-markdown; charset=utf-8", lastContentType.get());
    }

    @Test
    void anEmptyStringOrObjectMeansNoCollectionsNotAnError() {
        response = "{\"status\":\"success\",\"error\":{\"code\":200,\"message\":[]},\"data\":\"\"}";
        assertTrue(client.fetch(LocalDate.of(2026, 10, 24), LocalDate.of(2026, 10, 24)).isEmpty());

        response = "{\"status\":\"success\",\"error\":{\"code\":200,\"message\":[\"Data Not Available\"]},\"data\":{}}";
        assertTrue(client.fetch(LocalDate.of(2026, 10, 24), LocalDate.of(2026, 10, 24)).isEmpty());
    }

    @Test
    void aRejectedTokenIsReportedAsAnAuthProblem() {
        response = "{\"status\":\"error\",\"error\":{\"code\":\"\",\"message\":[\"Authentication Failed.\"]},\"data\":\"\"}";
        AmcsClient.AmcsAuthException ex = assertThrows(AmcsClient.AmcsAuthException.class,
            () -> client.fetch(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2)));
        assertTrue(ex.getMessage().contains("Authentication Failed"));
    }

    @Test
    void otherErrorsAndServerFailuresAreTransientNotAuth() {
        response = "{\"status\":\"error\",\"error\":{\"code\":500,\"message\":[\"Something broke\"]}}";
        assertThrows(AmcsClient.AmcsUnavailableException.class,
            () -> client.fetch(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2)));

        status = 500;
        response = "oops";
        assertThrows(AmcsClient.AmcsUnavailableException.class,
            () -> client.fetch(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2)));

        status = 200;
        response = "<html>maintenance</html>";
        assertThrows(AmcsClient.AmcsUnavailableException.class,
            () -> client.fetch(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2)));
    }

    @Test
    void httpUnauthorizedIsAnAuthProblem() {
        status = 401;
        assertThrows(AmcsClient.AmcsAuthException.class,
            () -> client.fetch(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2)));
    }

    @Test
    void anUnreachableServerIsTransient() {
        server.stop(0);
        assertThrows(AmcsClient.AmcsUnavailableException.class,
            () -> client.fetch(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2)));
    }

    @Test
    void missingCredentialsFailBeforeAnyRequestIsMade() {
        ReflectionTestUtils.setField(client, "token", "");
        assertFalse(client.isConfigured());
        assertThrows(AmcsClient.AmcsAuthException.class,
            () -> client.fetch(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2)));
        assertEquals(null, lastBody.get());
    }
}
