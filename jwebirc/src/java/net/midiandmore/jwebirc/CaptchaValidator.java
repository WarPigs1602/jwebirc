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
    
    // Constants for repeated strings
    private static final String SECRET_PARAM = "secret=";
    private static final String RESPONSE_PARAM = "&response=";
    private static final String REMOTEIP_PARAM = "&remoteip=";
    private static final String SUCCESS_KEY = "success";
    private static final String ERROR_CODES_KEY = "error-codes";
    private static final String UNKNOWN_ERROR = "Unknown error";
    private static final String SCORE_KEY = "score";
    
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
            String params = SECRET_PARAM + secretKey + RESPONSE_PARAM + token + REMOTEIP_PARAM + remoteIp;
            
            JsonObject response = sendPostRequest(url, params);
            
            if (response != null && response.containsKey(SUCCESS_KEY)) {
                boolean success = response.getBoolean(SUCCESS_KEY);
                if (success) {
                    LOGGER.log(Level.INFO, "Turnstile validation successful");
                    return true;
                } else {
                    LOGGER.log(Level.WARNING, "Turnstile validation failed: {0}", 
                              response.containsKey(ERROR_CODES_KEY) ? response.getJsonArray(ERROR_CODES_KEY).toString() : UNKNOWN_ERROR);
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
            String params = SECRET_PARAM + secretKey + RESPONSE_PARAM + token + REMOTEIP_PARAM + remoteIp;
            
            JsonObject response = sendPostRequest(url, params);
            
            if (response != null && response.containsKey(SUCCESS_KEY)) {
                boolean success = response.getBoolean(SUCCESS_KEY);
                if (success) {
                    LOGGER.log(Level.INFO, "reCAPTCHA v2 validation successful");
                    return true;
                } else {
                    LOGGER.log(Level.WARNING, "reCAPTCHA v2 validation failed: {0}", 
                              response.containsKey(ERROR_CODES_KEY) ? response.getJsonArray(ERROR_CODES_KEY).toString() : UNKNOWN_ERROR);
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
            String params = SECRET_PARAM + secretKey + RESPONSE_PARAM + token + REMOTEIP_PARAM + remoteIp;
            
            JsonObject response = sendPostRequest(url, params);
            
            if (response == null || !response.containsKey(SUCCESS_KEY)) {
                return false;
            }
            
            boolean success = response.getBoolean(SUCCESS_KEY);
            if (!success) {
                LOGGER.log(Level.WARNING, "reCAPTCHA v3 validation failed: {0}", 
                          response.containsKey(ERROR_CODES_KEY) ? response.getJsonArray(ERROR_CODES_KEY).toString() : UNKNOWN_ERROR);
                return false;
            }
            
            return validateRecaptchaV3Score(response, minScore);
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "reCAPTCHA v3 validation error", e);
            return false;
        }
    }
    
    /**
     * Validates the score from reCAPTCHA v3 response
     */
    private static boolean validateRecaptchaV3Score(JsonObject response, double minScore) {
        double score = response.containsKey(SCORE_KEY) ? response.getJsonNumber(SCORE_KEY).doubleValue() : 0.0;
        String action = response.containsKey("action") ? response.getString("action") : "";
        
        LOGGER.log(Level.INFO, "reCAPTCHA v3 validation - Score: {0}, Action: {1}", new Object[]{score, action});
        
        if (score >= minScore) {
            return true;
        }
        
        LOGGER.log(Level.WARNING, "reCAPTCHA v3 score too low: {0} < {1}", new Object[]{score, minScore});
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
            
            if (response == null || !response.containsKey("tokenProperties")) {
                return false;
            }
            
            return validateEnterpriseResponse(response, minScore);
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "reCAPTCHA Enterprise validation error", e);
            return false;
        }
    }
    
    /**
     * Validates the response from reCAPTCHA Enterprise
     */
    private static boolean validateEnterpriseResponse(JsonObject response, double minScore) {
        JsonObject tokenProps = response.getJsonObject("tokenProperties");
        boolean valid = tokenProps.getBoolean("valid", false);
        
        if (!valid) {
            String invalidReason = tokenProps.containsKey("invalidReason") ? 
                                 tokenProps.getString("invalidReason") : "Unknown";
            LOGGER.log(Level.WARNING, "reCAPTCHA Enterprise token invalid: {0}", invalidReason);
            return false;
        }
        
        if (!response.containsKey("riskAnalysis")) {
            return false;
        }
        
        return validateEnterpriseScore(response.getJsonObject("riskAnalysis"), minScore);
    }
    
    /**
     * Validates the risk score from reCAPTCHA Enterprise
     */
    private static boolean validateEnterpriseScore(JsonObject riskAnalysis, double minScore) {
        double score = riskAnalysis.containsKey(SCORE_KEY) ? riskAnalysis.getJsonNumber(SCORE_KEY).doubleValue() : 0.0;
        
        LOGGER.log(Level.INFO, "reCAPTCHA Enterprise validation - Score: {0}", score);
        
        if (score >= minScore) {
            return true;
        }
        
        LOGGER.log(Level.WARNING, "reCAPTCHA Enterprise score too low: {0} < {1}", new Object[]{score, minScore});
        return false;
    }
    
    /**
     * Sends a POST request with form data and returns JSON response
     */
    private static JsonObject sendPostRequest(String urlString, String params) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new java.net.URI(urlString).toURL().openConnection();
        
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
        HttpURLConnection conn = (HttpURLConnection) new java.net.URI(urlString).toURL().openConnection();
        
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
