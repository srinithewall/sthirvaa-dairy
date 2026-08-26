package com.dairy.controller;

import com.dairy.model.Role;
import com.dairy.model.User;
import com.dairy.repo.UserRepository;
import com.dairy.security.JwtUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth/sso")
@CrossOrigin(origins = "*", maxAge = 3600)
public class SsoExchangeController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtils jwtUtils;

    @Value("${sso.idp.url:http://localhost:8054/api/auth/sso/exchange}")
    private String idpExchangeUrl;

    @PostMapping("/exchange")
    public ResponseEntity<?> exchange(@RequestBody Map<String, String> request) {
        String code = request.get("code");
        String redirectUri = request.get("redirectUri");
        String state = request.get("state");

        if (code == null || redirectUri == null) {
            return ResponseEntity.badRequest().body("Code and redirectUri are required");
        }

        try {
            RestTemplate restTemplate = new RestTemplate();
            Map<String, String> idpRequest = new HashMap<>();
            idpRequest.put("code", code);
            idpRequest.put("redirectUri", redirectUri);
            idpRequest.put("clientId", "dairy-client");
            idpRequest.put("clientSecret", "dairy-secret-key-12345");

            ResponseEntity<Map> idpResponse = restTemplate.postForEntity(idpExchangeUrl, idpRequest, Map.class);
            
            if (idpResponse.getStatusCode().is2xxSuccessful() && idpResponse.getBody() != null) {
                Map<String, Object> userData = idpResponse.getBody();
                String username = (String) userData.get("username");
                String phone = (String) userData.get("phone");
                
                Optional<User> optionalUser = userRepository.findByUsername(username);
                User user;
                if (optionalUser.isEmpty()) {
                    user = new User();
                    user.setUsername(username);
                    user.setEmail(phone != null ? phone + "@dairy.sthirvaa.com" : username + "@dairy.sthirvaa.com");
                    user.setPassword("SSO_MANAGED");
                    user.setRole(Role.CUSTOMER); // Default role
                    userRepository.save(user);
                } else {
                    user = optionalUser.get();
                }

                String token = jwtUtils.generateJwtToken(user.getEmail());

                Map<String, Object> response = new HashMap<>();
                response.put("token", token);
                response.put("user", user);
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(401).body("Invalid SSO code");
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error exchanging SSO code: " + e.getMessage());
        }
    }
}
