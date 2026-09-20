package com.sudheeai.backend.controller;

import com.sudheeai.backend.model.User;
import com.sudheeai.backend.model.Student;
import com.sudheeai.backend.model.Recruiter;
import com.sudheeai.backend.repository.UserRepository;
import com.sudheeai.backend.repository.StudentRepository;
import com.sudheeai.backend.repository.RecruiterRepository;
import com.sudheeai.backend.security.JwtTokenProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import com.sudheeai.backend.model.StudentProfile;
import com.sudheeai.backend.repository.StudentProfileRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final StudentRepository studentRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final RecruiterRepository recruiterRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${app.google.client-id:}")
    private String googleClientId;

    public AuthController(
            UserRepository userRepository,
            StudentRepository studentRepository,
            StudentProfileRepository studentProfileRepository,
            RecruiterRepository recruiterRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.studentRepository = studentRepository;
        this.studentProfileRepository = studentProfileRepository;
        this.recruiterRepository = recruiterRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, Object> body) {
        String email = (String) body.get("email");
        String password = (String) body.get("password");
        String role = (String) body.get("role");

        if (email == null || password == null || role == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email, password, and role are required"));
        }

        String normalizedRole = role.trim().toLowerCase();
        if (!"student".equals(normalizedRole) && !"recruiter".equals(normalizedRole)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Role must be 'student' or 'recruiter'"));
        }

        String trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail.matches("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid email format"));
        }
        if (password.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 8 characters"));
        }

        if (userRepository.findByEmail(trimmedEmail).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "User already registered"));
        }

        User user = new User(trimmedEmail, passwordEncoder.encode(password), normalizedRole);
        user = userRepository.save(user);
        
        if ("student".equals(normalizedRole)) {
            Student student = new Student();
            student.setUserId(user.getId());
            student.setEmail(trimmedEmail);
            student.setName((String) body.getOrDefault("name", trimmedEmail.split("@")[0]));
            student.setInstitution((String) body.getOrDefault("institution", "Not Specified"));
            student.setDegree((String) body.getOrDefault("degree", "Not Specified"));
            student.setBranch((String) body.getOrDefault("branch", "Not Specified"));
            
            Object gradYearObj = body.get("graduationYear");
            Integer gradYear = 2025;
            if (gradYearObj instanceof Integer) {
                gradYear = (Integer) gradYearObj;
            } else if (gradYearObj instanceof Number) {
                gradYear = ((Number) gradYearObj).intValue();
            } else if (gradYearObj instanceof String) {
                try { gradYear = Integer.parseInt(((String) gradYearObj).trim()); } catch (Exception e) {}
            }
            student.setGraduationYear(gradYear);
            
            try {
                student = studentRepository.save(student);
            } catch (Exception e) {
                userRepository.delete(user);
                return ResponseEntity.status(409).body(Map.of("error", "Could not create student profile"));
            }
            
            StudentProfile profile = new StudentProfile();
            profile.setStudentId(student.getId());
            studentProfileRepository.save(profile);
        } else if ("recruiter".equals(normalizedRole)) {
            Recruiter recruiter = new Recruiter();
            recruiter.setUserId(user.getId());
            recruiter.setEmail(trimmedEmail);
            recruiter.setRecruiterName((String) body.getOrDefault("name", trimmedEmail.split("@")[0]));
            recruiter.setCompanyName((String) body.getOrDefault("companyName", "Not Specified"));
            try {
                recruiterRepository.save(recruiter);
            } catch (Exception e) {
                userRepository.delete(user);
                return ResponseEntity.status(409).body(Map.of("error", "Could not create recruiter profile"));
            }
        }

        String token = tokenProvider.generateToken(user.getEmail(), user.getId(), user.getRole());
        return ResponseEntity.ok(Map.of("message", "Registered successfully", "token", token, "userId", user.getId().toString()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");

        if (email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and password are required"));
        }

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty() || !passwordEncoder.matches(password, userOpt.get().getPassword())) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid email or password"));
        }

        User user = userOpt.get();
        String token = tokenProvider.generateToken(user.getEmail(), user.getId(), user.getRole());
        return ResponseEntity.ok(Map.of("token", token, "userId", user.getId().toString(), "role", user.getRole()));
    }

    /**
     * Google Sign-In for the local database mode.
     * Frontend obtains an ID token via Google Identity Services (GIS) using
     * VITE_GOOGLE_CLIENT_ID, then POSTs {idToken, role} here.
     * Verified against Google, then find-or-create User + Student/Recruiter +
     * StudentProfile rows, and returns the same JWT shape as /login.
     */
    @PostMapping("/google")
    public ResponseEntity<?> google(@RequestBody Map<String, Object> body) {
        String idToken = (String) body.get("idToken");
        if (idToken == null) idToken = (String) body.get("id_token");
        String role = (String) body.get("role");
        if (idToken == null || idToken.isBlank() || role == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "idToken and role are required"));
        }
        String normalizedRole = role.trim().toLowerCase();
        if (!"student".equals(normalizedRole) && !"recruiter".equals(normalizedRole)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Role must be 'student' or 'recruiter'"));
        }

        Map<String, Object> claims;
        try {
            claims = verifyGoogleIdToken(idToken);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of("error", "Google verification failed. Try again."));
        }

        String email = String.valueOf(claims.getOrDefault("email", "")).trim().toLowerCase();
        Object verifiedObj = claims.get("email_verified");
        boolean verified = "true".equalsIgnoreCase(String.valueOf(verifiedObj));
        if (email.isEmpty() || !email.contains("@")) {
            return ResponseEntity.status(401).body(Map.of("error", "Google token has no email"));
        }
        if (!verified) {
            return ResponseEntity.status(401).body(Map.of("error", "Google email not verified"));
        }
        String googleName = (String) claims.getOrDefault("name", email.split("@")[0]);

        Optional<User> existing = userRepository.findByEmail(email);
        User user;
        if (existing.isPresent()) {
            user = existing.get();
            if (!normalizedRole.equalsIgnoreCase(user.getRole())) {
                return ResponseEntity.status(403).body(Map.of(
                        "error", "This email is registered as " + user.getRole() + ". Use the " + user.getRole() + " portal."));
            }
        } else {
            user = new User(email, passwordEncoder.encode(UUID.randomUUID().toString()), normalizedRole);
            try {
                user = userRepository.save(user);
            } catch (Exception e) {
                return ResponseEntity.status(409).body(Map.of("error", "Could not create user"));
            }
            if ("student".equals(normalizedRole)) {
                Student student = new Student();
                student.setUserId(user.getId());
                student.setEmail(email);
                student.setName(googleName);
                student.setInstitution("Not Specified");
                student.setDegree("Not Specified");
                student.setBranch("Not Specified");
                student.setGraduationYear(2025);
                try {
                    student = studentRepository.save(student);
                } catch (Exception e) {
                    userRepository.delete(user);
                    return ResponseEntity.status(409).body(Map.of("error", "Could not create student profile"));
                }
                StudentProfile profile = new StudentProfile();
                profile.setStudentId(student.getId());
                studentProfileRepository.save(profile);
            } else {
                Recruiter recruiter = new Recruiter();
                recruiter.setUserId(user.getId());
                recruiter.setEmail(email);
                recruiter.setRecruiterName(googleName);
                recruiter.setCompanyName("Not Specified");
                try {
                    recruiterRepository.save(recruiter);
                } catch (Exception e) {
                    userRepository.delete(user);
                    return ResponseEntity.status(409).body(Map.of("error", "Could not create recruiter profile"));
                }
            }
        }

        String token = tokenProvider.generateToken(user.getEmail(), user.getId(), user.getRole());
        return ResponseEntity.ok(Map.of("token", token, "userId", user.getId().toString(), "role", user.getRole()));
    }

    private Map<String, Object> verifyGoogleIdToken(String idToken) throws Exception {
        String url = "https://oauth2.googleapis.com/tokeninfo?id_token="
                + URLEncoder.encode(idToken, StandardCharsets.UTF_8);
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(10)).GET().build();
        HttpResponse<String> res = HttpClient.newHttpClient().send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) {
            throw new IllegalArgumentException("Invalid Google credential");
        }
        Map<String, Object> claims = objectMapper.readValue(res.body(),
                new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
        if (googleClientId != null && !googleClientId.isBlank()) {
            Object aud = claims.get("aud");
            if (!googleClientId.equals(String.valueOf(aud))) {
                throw new IllegalArgumentException("Google credential was issued for a different app");
            }
        }
        Object expObj = claims.get("exp");
        if (expObj != null) {
            try {
                long exp = Long.parseLong(String.valueOf(expObj));
                if (exp * 1000L < System.currentTimeMillis()) {
                    throw new IllegalArgumentException("Google credential expired");
                }
            } catch (NumberFormatException ignored) { /* tokeninfo always numeric */ }
        }
        return claims;
    }

    /** Change password for the logged-in user (used by Reset page in local mode). */
    @PostMapping("/password")
    public ResponseEntity<?> changePassword(
            @RequestAttribute(value = "userId", required = false) UUID userId,
            @RequestBody Map<String, Object> body) {
        if (userId == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        String pw = (String) body.get("newPassword");
        if (pw == null) pw = (String) body.get("password");
        if (pw == null || pw.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 8 characters"));
        }
        Optional<User> opt = userRepository.findById(userId);
        if (opt.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        User u = opt.get();
        u.setPassword(passwordEncoder.encode(pw));
        userRepository.save(u);
        return ResponseEntity.ok(Map.of("message", "Password updated"));
    }

    /**
     * Forgot-password in local mode: no SMTP is configured, so always return
     * success to avoid account enumeration. Real reset happens via the
     * authenticated POST /api/auth/password after the user signs in,
     * or via Supabase Cloud email when VITE_SUPABASE_URL is set.
     */
    @PostMapping("/forgot")
    public ResponseEntity<?> forgot(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(Map.of("message", "If an account exists, reset instructions were sent."));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMe(
            @RequestAttribute("userId") UUID userId,
            @RequestAttribute("userRole") String role,
            @RequestAttribute("userEmail") String email) {
        
        Map<String, Object> response = new HashMap<>();
        response.put("id", userId);
        response.put("email", email);
        response.put("role", role);

        if ("student".equalsIgnoreCase(role)) {
            Optional<Student> studentOpt = studentRepository.findByUserId(userId);
            studentOpt.ifPresent(student -> response.put("profile", student));
        } else if ("recruiter".equalsIgnoreCase(role)) {
            Optional<Recruiter> recruiterOpt = recruiterRepository.findByUserId(userId);
            recruiterOpt.ifPresent(recruiter -> response.put("profile", recruiter));
        }

        return ResponseEntity.ok(response);
    }
}
