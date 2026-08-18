package backendservice;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriUtils;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class SalesforceService {

    private final RestTemplate restTemplate = new RestTemplate();
    private String accessToken;
    private String instanceUrl;

    @Value("${salesforce.client.id}") private String clientId;
    @Value("${salesforce.client.secret}") private String clientSecret;
    @Value("${salesforce.username}") private String username;
    @Value("${salesforce.password}") private String password;
    @Value("${salesforce.instance.url}") private String loginUrl;

    // 1. Login to get Access Token - runs once
    private void login() {
        if (accessToken != null) return; // already logged in

        String url = loginUrl + "/services/oauth2/token";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        String body = "grant_type=password&client_id=" + clientId +
                "&client_secret=" + clientSecret +
                "&username=" + username +
                "&password=" + password;

        ResponseEntity<Map> response = restTemplate.postForEntity(url, new HttpEntity<>(body, headers), Map.class);
        Map map = response.getBody();
        this.accessToken = (String) map.get("access_token");
        this.instanceUrl = (String) map.get("instance_url");
    }

    // Common headers
    private HttpHeaders getHeaders() {
        login(); // ensure we are logged in
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    // 2. READ - Get 20 records with pagination for any object
    public List<Map<String, Object>> getRecords(String object, int page) {
        int offset = page * 20;
        String soql = "SELECT Id, Name FROM " + object + " ORDER BY CreatedDate DESC LIMIT 20 OFFSET " + offset;
        String encodedSoql = UriUtils.encode(soql, StandardCharsets.UTF_8);
        String url = instanceUrl + "/services/data/v61.0/query?q=" + encodedSoql;

        ResponseEntity<Map> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                new HttpEntity<>(getHeaders()),
                Map.class
        );
        return (List<Map<String, Object>>) response.getBody().get("records");
    }

    // 3. READ - Get single record
    public Map<String, Object> getById(String object, String id) {
        String url = instanceUrl + "/services/data/v61.0/sobjects/" + object + "/" + id;
        ResponseEntity<Map> response = restTemplate.exchange(
                url, HttpMethod.GET, new HttpEntity<>(getHeaders()), Map.class
        );
        return response.getBody();
    }

    // 4. CREATE
    public Map<String, Object> createRecord(String object, Map<String, String> data) {
        String url = instanceUrl + "/services/data/v61.0/sobjects/" + object + "/";
        ResponseEntity<Map> response = restTemplate.postForEntity(
                url, new HttpEntity<>(data, getHeaders()), Map.class
        );
        return response.getBody();
    }

    // 5. UPDATE
    public String updateRecord(String object, String id, Map<String, Object> data) {
        String url = instanceUrl + "/services/data/v61.0/sobjects/" + object + "/" + id;
        restTemplate.exchange(url, HttpMethod.PATCH, new HttpEntity<>(data, getHeaders()), Void.class);
        return "Updated Successfully";
    }

    // 6. DELETE
    public String deleteRecord(String object, String id) {
        String url = instanceUrl + "/services/data/v61.0/sobjects/" + object + "/" + id;
        restTemplate.exchange(url, HttpMethod.DELETE, new HttpEntity<>(getHeaders()), Void.class);
        return "Deleted Successfully";
    }
}