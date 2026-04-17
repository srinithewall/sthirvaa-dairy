package com.dairy.security;

import com.dairy.model.User;
import com.dairy.model.Role;
import com.dairy.repo.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import java.util.Collections;
import java.util.Optional;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String emailOrUsername) throws UsernameNotFoundException {
        Optional<User> userOpt = userRepository.findByEmail(emailOrUsername);
        if (!userOpt.isPresent()) {
            userOpt = userRepository.findByUsername(emailOrUsername);
        }
        
        User user = userOpt.orElseThrow(() -> new UsernameNotFoundException("User not found: " + emailOrUsername));

        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPassword(),
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );
    }
}
