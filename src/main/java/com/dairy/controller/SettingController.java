package com.dairy.controller;

import com.dairy.model.Setting;
import com.dairy.repository.SettingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/settings")
public class SettingController {

    @Autowired
    private SettingRepository settingRepository;

    @GetMapping("/{key}")
    public ResponseEntity<?> getSetting(@PathVariable String key) {
        return settingRepository.findById(key)
                .map(setting -> ResponseEntity.ok().body(setting))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> updateSetting(@RequestBody Setting setting) {
        Setting saved = settingRepository.save(setting);
        return ResponseEntity.ok(saved);
    }
}
