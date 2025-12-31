package net.midiandmore.jwebirc;

import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonReader;
import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.InputStreamReader;
import java.io.StringReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Validates CAPTCHA responses for various CAPTCHA providers
 * Supports: Cloudflare Turnstile, Google reCAPTCHA v2, v3, and Enterprise
 * 
 * @author Andreas Pschorn
 */
public class CaptchaValidator {
    
    private static final Logger LOGGER = Logger.getLogger(CaptchaValidator.class.getName());
    
    // CAPTCHA Provider Types
    public enum CaptchaType {
        NONE,
        TURNSTILE,
        RECAPTCHA_V2,
        RECAPTCHA_V3,
        RECAPTCHA_ENTERPRISE
    }
    
    /**
     * Validates a CAPTCHA response
     * 
     * @param captchaType The type of CAPTCHA to validate
     * @param token The CAPTCHA response token from the client
     * @param secretKey The secret key for the CAPTCHA provider
     * @param remoteIp The IP address of the user
     * @param projectId The Google Cloud project ID (only for reCAPTCHA Enterprise)
     * @param siteKey The CAPTCHA site key (only for reCAPTCHA Enterprise)
     * @param minScore Minimum score required for v3 (0.0 to 1.0, typically 0.5)
     * @return true if CAPTCHA is valid, false otherwise
     */
    public static boolean validate(CaptchaType captchaType, String token, String secretKey, 
                                  String remoteIp, String projectId, String siteKey, double minScore) {
        if (captchaType == CaptchaType.NONE || token == null || token.isEmpty()) {
            return captchaType == CaptchaType.NONE;
        }
        
        try {
            switch (captchaType) {
                case TURNSTILE:
                    return validateTurnstile(token, secretKey, remoteIp);
                case RECAPTCHA_V2:
                    return validateRecaptchaV2(token, secretKey, remoteIp);
                case RECAPTCHA_V3:
                    return validateRecaptchaV3(token, secretKey, remoteIp, minScore);
                case RECAPTCHA_ENTERPRISE:
                    return validateRecaptchaEnterprise(token, secretKey, remoteIp, projectId, siteKey, minScore);
                default:
                    return false;
            }
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "CAPTCHA validation error", e);
            return false;
        }
    }
    
    /**
     * Validates Cloudflare Turnstile CAPTCHA
     */
    private static boolean validateTurnstile(String token, String secretKey, String remoteIp) {
        try {
            String url = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
            String params = "secret=" + secretKey + "&response=" + token + "&remoteip=" + remoteIp;
            
            JsonObject response = sendPostRequest(url, params);
            
            if (response != null && response.containsKey("success")) {
                boolean success = response.getBoolean("success");
                if (success) {
                    LOGGER.log(Level.INFO, "Turnstile validation successful");
                    return true;
                } else {
                    LOGGER.log(Level.WARNING, "Turnstile validation failed: {0}", 
                              response.containsKey("error-codes") ? response.getJsonArray("error-codes").toString() : "Unknown error");
                }
            }
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Turnstile validation error", e);
        }
        return false;
    }
    
    /**
     * Validates Google reCAPTCHA v2
     */
    private static boolean validateRecaptchaV2(String token, String secretKey, String remoteIp) {
        try {
            String url = "https://www.google.com/recaptcha/api/siteverify";
            String params = "secret=" + secretKey + "&response=" + token + "&remoteip=" + remoteIp;
            
            JsonObject response = sendPostRequest(url, params);
            
            if (response != null && response.containsKey("success")) {
                boolean success = response.getBoolean("success");
                if (success) {
                    LOGGER.log(Level.INFO, "reCAPTCHA v2 validation successful");
                    return true;
                } else {
                    LOGGER.log(Level.WARNING, "reCAPTCHA v2 validation failed: {0}", 
                              response.containsKey("error-codes") ? response.getJsonArray("error-codes").toString() : "Unknown error");
                }
            }
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "reCAPTCHA v2 validation error", e);
        }
        return false;
    }
    
    /**
     * Validates Google reCAPTCHA v3
     */
    private static boolean validateRecaptchaV3(String token, String secretKey, String remoteIp, double minScore) {
        try {
            String url = "https://www.google.com/recaptcha/api/siteverify";
            String params = "secret=" + secretKey + "&response=" + token + "&remoteip=" + remoteIp;
            
            JsonObject response = sendPostRequest(url, params);
            
            if (response != null && response.containsKey("success")) {
                boolean success = response.getBoolean("success");
                if (success) {
                    double score = response.containsKey("score") ? response.getJsonNumber("score").doubleValue() : 0.0;
                    String action = response.containsKey("action") ? response.getString("action") : "";
                    
                    LOGGER.log(Level.INFO, "reCAPTCHA v3 validation - Score: {0}, Action: {1}", new Object[]{score, action});
                    
                    if (score >= minScore) {
                        return true;
                    } else {
                        LOGGER.log(Level.WARNING, "reCAPTCHA v3 score too low: {0} < {1}", new Object[]{score, minScore});
                    }
                } else {
                    LOGGER.log(Level.WARNING, "reCAPTCHA v3 validation failed: {0}", 
                              response.containsKey("error-codes") ? response.getJsonArray("error-codes").toString() : "Unknown error");
                }
            }
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "reCAPTCHA v3 validation error", e);
        }
        return false;
    }
    
    /**
     * Validates Google reCAPTCHA Enterprise
     */
    private static boolean validateRecaptchaEnterprise(String token, String secretKey, String remoteIp, 
                                                       String projectId, String siteKey, double minScore) {
        try {
            String url = "https://recaptchaenterprise.googleapis.com/v1/projects/" + projectId + "/assessments?key=" + secretKey;
            
            // Build JSON request body
            String jsonBody = Json.createObjectBuilder()
                .add("event", Json.createObjectBuilder()
                    .add("token", token)
                    .add("siteKey", siteKey)
                    .add("expectedAction", "LOGIN")
                    .add("userIpAddress", remoteIp))
                .build()
                .toString();
            
            JsonObject response = sendPostRequestJson(url, jsonBody);
            
            if (response != null && response.containsKey("tokenProperties")) {
                JsonObject tokenProps = response.getJsonObject("tokenProperties");
                boolean valid = tokenProps.getBoolean("valid", false);
                
                if (valid && response.containsKey("riskAnalysis")) {
                    JsonObject riskAnalysis = response.getJsonObject("riskAnalysis");
                    double score = riskAnalysis.containsKey("score") ? riskAnalysis.getJsonNumber("score").doubleValue() : 0.0;
                    
                    LOGGER.log(Level.INFO, "reCAPTCHA Enterprise validation - Score: {0}", score);
                    
                    if (score >= minScore) {
                        return true;
                    } else {
                        LOGGER.log(Level.WARNING, "reCAPTCHA Enterprise score too low: {0} < {1}", new Object[]{score, minScore});
                    }
                } else if (!valid) {
                    String invalidReason = tokenProps.containsKey("invalidReason") ? 
                                         tokenProps.getString("invalidReason") : "Unknown";
                    LOGGER.log(Level.WARNING, "reCAPTCHA Enterprise token invalid: {0}", invalidReason);
                }
            }
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "reCAPTCHA Enterprise validation error", e);
        }
        return false;
    }
    
    /**
     * Sends a POST request with form data and returns JSON response
     */
    private static JsonObject sendPostRequest(String urlString, String params) throws Exception {
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        conn.setRequestProperty("User-Agent", "jwebirc/1.0");
        conn.setDoOutput(true);
        
        try (DataOutputStream wr = new DataOutputStream(conn.getOutputStream())) {
            wr.write(params.getBytes(StandardCharsets.UTF_8));
            wr.flush();
        }
        
        int responseCode = conn.getResponseCode();
        if (responseCode == HttpURLConnection.HTTP_OK) {
            try (BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
                StringBuilder response = new StringBuilder();
                String inputLine;
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                
                try (JsonReader jsonReader = Json.createReader(new StringReader(response.toString()))) {
                    return jsonReader.readObject();
                }
            }
        } else {
            LOGGER.log(Level.WARNING, "HTTP error code: {0}", responseCode);
        }
        
        return null;
    }
    
    /**
     * Sends a POST request with JSON body and returns JSON response
     */
    private static JsonObject sendPostRequestJson(String urlString, String jsonBody) throws Exception {
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("User-Agent", "jwebirc/1.0");
        conn.setDoOutput(true);
        
        try (DataOutputStream wr = new DataOutputStream(conn.getOutputStream())) {
            wr.write(jsonBody.getBytes(StandardCharsets.UTF_8));
            wr.flush();
        }
        
        int responseCode = conn.getResponseCode();
        if (responseCode == HttpURLConnection.HTTP_OK) {
            try (BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
                StringBuilder response = new StringBuilder();
                String inputLine;
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                
                try (JsonReader jsonReader = Json.createReader(new StringReader(response.toString()))) {
                    return jsonReader.readObject();
                }
            }
        } else {
            LOGGER.log(Level.WARNING, "HTTP error code: {0}", responseCode);
        }
        
        return null;
    }
}
