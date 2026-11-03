package com.dairy.config;

import com.dairy.security.ModulePermissionInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Puts role_permissions in front of every API route (see ModulePermissionInterceptor). */
@Configuration
public class ModulePermissionConfig implements WebMvcConfigurer {

    private final ModulePermissionInterceptor modulePermissionInterceptor;

    public ModulePermissionConfig(ModulePermissionInterceptor modulePermissionInterceptor) {
        this.modulePermissionInterceptor = modulePermissionInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(modulePermissionInterceptor).addPathPatterns("/api/**");
    }
}
