import com.fastcgi.FCGIInterface;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

public class Server {
    private static final List<String> history = Collections.synchronizedList(new ArrayList<>());

    public static void main(String[] args) {
        FCGIInterface fcgiInterface = new FCGIInterface();

        while (fcgiInterface.FCGIaccept() >= 0) {
            long startTime = System.nanoTime();

            try {
                String method = FCGIInterface.request.params.getProperty("REQUEST_METHOD");
                if (!"GET".equals(method)) {
                    sendResponse(405, "Method Not Allowed", "{\"error\": \"Only GET method is supported\"}");
                    continue;
                }

                String queryString = FCGIInterface.request.params.getProperty("QUERY_STRING");

                if (queryString != null && queryString.contains("clear=1")) {
                    history.clear();
                    sendResponse(200, "OK", "[]");
                    continue;
                }

                if (queryString != null && queryString.contains("ping=1")) {
                    sendResponse(200, "OK", "{\"status\": \"alive\"}");
                    continue;
                }

                double x = 0, y = 0, r = 0;

                if (queryString != null) {
                    String[] pairs = queryString.split("&");
                    for (String pair : pairs) {
                        String[] keyValue = pair.split("=");
                        if (keyValue.length == 2) {
                            try {
                                double val = Double.parseDouble(keyValue[1]);
                                if ("x".equals(keyValue[0])) x = val;
                                else if ("y".equals(keyValue[0])) y = val;
                                else if ("r".equals(keyValue[0])) r = val;
                            } catch (NumberFormatException ignored) {}
                        }
                    }
                }

                boolean hit = checkHit(x, y, r);

                long endTime = System.nanoTime();
                double executionTimeMs = (endTime - startTime) / 1_000_000.0;
                String currentTime = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

                String jsonResult = String.format(
                    Locale.US,
                    "{\"x\": %.2f, \"y\": %.2f, \"r\": %.2f, \"hit\": %b, \"time\": \"%s\", \"exec_time\": \"%s\"}",
                    x, y, r, hit, currentTime, executionTimeMs
                );
                history.add(jsonResult);
                String jsonResponse = "[" + String.join(",", history) + "]";

                sendResponse(200, "OK", jsonResponse);

            } catch (Exception e) {
                sendResponse(500, "Internal Server Error", "{\"error\": \"" + e.getMessage() + "\"}");
            }
        }
    }

    private static boolean checkHit(double x, double y, double r) {
        if (x >= 0 && y >= 0) return (x + 2 * y) <= r;
        if (x <= 0 && y >= 0) return x >= -r && y <= r;
        if (x <= 0 && y <= 0) return (x * x + y * y) <= (r / 2) * (r / 2);
        return false;
    }

    private static void sendResponse(int statusCode, String statusText, String jsonBody) {
        byte[] bodyBytes = jsonBody.getBytes(StandardCharsets.UTF_8);
        String cgiResponse = String.format(
            Locale.US,
            "Status: %d %s\r\n" +
            "Content-Type: application/json; charset=UTF-8\r\n" +
            "Content-Length: %d\r\n" +
            "\r\n" +
            "%s",
            statusCode, statusText, bodyBytes.length, jsonBody
        );
        System.out.print(cgiResponse);
        System.out.flush();
    }
}
