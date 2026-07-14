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

        if (userRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "User already registered"));
        }

        User user = new User(email, passwordEncoder.encode(password), role);
        user = userRepository.save(user);
        
        if ("student".equalsIgnoreCase(role)) {
            Student student = new Student();
            student.setUserId(user.getId());
            student.setEmail(email);
            student.setName((String) body.getOrDefault("name", email.split("@")[0]));
            student.setInstitution((String) body.getOrDefault("institution", "Not Specified"));
            student.setDegree((String) body.getOrDefault("degree", "Not Specified"));
            student.setBranch((String) body.getOrDefault("branch", "Not Specified"));
            
            Object gradYearObj = body.get("graduationYear");
            Integer gradYear = 2025;
            if (gradYearObj instanceof Integer) {
                gradYear = (Integer) gradYearObj;
            } else if (gradYearObj instanceof String) {
                try { gradYear = Integer.parseInt((String) gradYearObj); } catch (Exception e) {}
            }
            student.setGraduationYear(gradYear);
            
            student = studentRepository.save(student);
            
            StudentProfile profile = new StudentProfile();
            profile.setStudentId(student.getId());
            studentProfileRepository.save(profile);
        } else if ("recruiter".equalsIgnoreCase(role)) {
            Recruiter recruiter = new Recruiter();
            recruiter.setUserId(user.getId());
            recruiter.setEmail(email);
            recruiter.setRecruiterName((String) body.getOrDefault("name", email.split("@")[0]));
            recruiter.setCompanyName((String) body.getOrDefault("companyName", "Not Specified"));
            recruiterRepository.save(recruiter);
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
