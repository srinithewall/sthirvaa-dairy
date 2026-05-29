package com.dairy.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import jakarta.annotation.PostConstruct;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;

@Configuration
public class FirebaseConfig {

    private static final Logger logger = LoggerFactory.getLogger(FirebaseConfig.class);

    @PostConstruct
    public void initializeFirebase() {
        try {
            if (!FirebaseApp.getApps().isEmpty()) {
                logger.info("Firebase already initialized.");
                return;
            }

            InputStream serviceAccount = null;

            // Try loading from classpath
            ClassLoader classLoader = getClass().getClassLoader();
            InputStream classPathStream = classLoader.getResourceAsStream("service-account.json");
            
            if (classPathStream != null) {
                logger.info("Loading Firebase credentials from classpath (service-account.json)...");
                serviceAccount = classPathStream;
            } else {
                // Try loading from external file in workspace root
                File externalFile = new File("firebase-service-account.json");
                if (externalFile.exists()) {
                    logger.info("Loading Firebase credentials from external file (firebase-service-account.json)...");
                    serviceAccount = new FileInputStream(externalFile);
                }
            }

            if (serviceAccount == null) {
                logger.warn("==========================================================================");
                logger.warn("FIREBASE INITIALIZATION WARNING:");
                logger.warn("No 'service-account.json' (classpath) or 'firebase-service-account.json' (root) found!");
                logger.warn("Push notifications cannot be sent over the network without service account credentials.");
                logger.warn("Please place your Firebase Service Account JSON file in the project.");
                logger.warn("==========================================================================");
                return;
            }

            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                    .build();

            FirebaseApp.initializeApp(options);
            logger.info("Firebase App initialized successfully!");
        } catch (Exception e) {
            logger.error("Failed to initialize Firebase App:", e);
        }
    }
}
