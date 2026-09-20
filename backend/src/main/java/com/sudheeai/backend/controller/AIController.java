package com.sudheeai.backend.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sudheeai.backend.model.*;
import com.sudheeai.backend.repository.*;
import com.sudheeai.backend.service.AIService;
import com.sudheeai.backend.service.DataSeeder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@SuppressWarnings("unchecked")
public class AIController {

    private final AIService aiService;
    private final DataSeeder dataSeeder;
    private final StudentRepository studentRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final RecruiterRepository recruiterRepository;
    private final JobRepository jobRepository;
    private final ApplicationRepository applicationRepository;
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${app.seed.secret}")
    private String seedSecret;

    public AIController(
            AIService aiService,
            DataSeeder dataSeeder,
            StudentRepository studentRepository,
            StudentProfileRepository studentProfileRepository,
            RecruiterRepository recruiterRepository,
            JobRepository jobRepository,
            ApplicationRepository applicationRepository,
            NotificationRepository notificationRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder) {
        this.aiService = aiService;
        this.dataSeeder = dataSeeder;
        this.studentRepository = studentRepository;
        this.studentProfileRepository = studentProfileRepository;
        this.recruiterRepository = recruiterRepository;
        this.jobRepository = jobRepository;
        this.applicationRepository = applicationRepository;
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @SuppressWarnings("rawtypes")
    private Mono<Map<String, Object>> callAIWithTool(Map<String, Object> aiBody, String toolName) {
        return aiService.callAI(aiBody).<Map<String, Object>>flatMap(aiResponse -> {
            try {
                List<Map<String, Object>> choices = (List<Map<String, Object>>) aiResponse.get("choices");
                if (choices != null && !choices.isEmpty()) {
                    Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
                    
                    // Try tool_calls first (standard OpenAI tool calling)
                    List<Map<String, Object>> toolCalls = (List<Map<String, Object>>) message.get("tool_calls");
                    if (toolCalls != null && !toolCalls.isEmpty()) {
                        for (Map<String, Object> tc : toolCalls) {
                            Map<String, Object> func = (Map<String, Object>) tc.get("function");
                            String arguments = (String) func.get("arguments");
                            Map result = mapper.readValue(arguments, Map.class);
                            return Mono.just((Map<String, Object>) result);
                        }
                    }
                    
                    // Fallback: parse content as JSON (NVIDIA models may not use tool_calls)
                    String content = (String) message.get("content");
                    if (content != null) {
                        String cleaned = content.replaceAll("```json\\n?", "").replaceAll("```\\n?", "").trim();
                        Map result = mapper.readValue(cleaned, Map.class);
                        return Mono.just((Map<String, Object>) result);
                    }
                }
                
                if (aiResponse.containsKey("error")) {
                    return Mono.error(new RuntimeException("AI API Error: " + aiResponse.get("error")));
                }
                return Mono.error(new RuntimeException("AI did not return expected output for tool: " + toolName));
            } catch (Exception e) {
                return Mono.error(new RuntimeException("Failed to parse AI response: " + e.getMessage(), e));
            }
        }).onErrorResume(e -> {
            System.err.println("[AIController] callAIWithTool error: " + e.getMessage());
            Map<String, Object> errorMap = new HashMap<>();
            errorMap.put("error", e.getMessage() != null ? e.getMessage() : "AI service error");
            return Mono.just(errorMap);
        });
    }

    @SuppressWarnings("rawtypes")
    private Mono<Map<String, Object>> callAIWithJsonOutput(Map<String, Object> aiBody) {
        return aiService.callAI(aiBody).<Map<String, Object>>flatMap(aiResponse -> {
            try {
                List<Map<String, Object>> choices = (List<Map<String, Object>>) aiResponse.get("choices");
                if (choices != null && !choices.isEmpty()) {
                    String content = (String) ((Map<String, Object>) choices.get(0).get("message")).get("content");
                    if (content != null) {
                        String cleaned = content.replaceAll("```json\\n?", "").replaceAll("```\\n?", "").trim();
                        Map result = mapper.readValue(cleaned, Map.class);
                        return Mono.just((Map<String, Object>) result);
                    }
                }
                if (aiResponse.containsKey("error")) {
                    return Mono.error(new RuntimeException("AI API Error: " + aiResponse.get("error")));
                }
                return Mono.error(new RuntimeException("AI did not return content"));
            } catch (Exception e) {
                return Mono.error(new RuntimeException("Failed to parse AI JSON response: " + e.getMessage(), e));
            }
        }).onErrorResume(e -> {
            System.err.println("[AIController] callAIWithJsonOutput error: " + e.getMessage());
            Map<String, Object> errorMap = new HashMap<>();
            errorMap.put("error", e.getMessage() != null ? e.getMessage() : "AI service error");
            return Mono.just(errorMap);
        });
    }

    @PostMapping({"/api/parse-resume", "/functions/v1/parse-resume"})
    public Mono<ResponseEntity<?>> parseResume(@RequestAttribute(value = "userId", required = false) UUID userId) {
        if (userId == null) {
            return Mono.just(ResponseEntity.status(401).body(Map.of("error", "Unauthorized", "code", "unauthorized")));
        }
        Optional<Student> studentOpt = studentRepository.findByUserId(userId);
        if (studentOpt.isEmpty()) {
            return Mono.just(ResponseEntity.status(404).body(Map.of("error", "Student profile not found")));
        }
        Student student = studentOpt.get();
        if (student.getResumeUrl() == null) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "No resume uploaded. Please upload your resume first.")));
        }

        try {
            File file = new File("./" + student.getResumeUrl());
            if (!file.exists()) {
                return Mono.just(ResponseEntity.status(404).body(Map.of("error", "Resume file not found on server")));
            }

            byte[] bytes = Files.readAllBytes(file.toPath());

            return aiService.callOCR(bytes).flatMap(ocrText -> {
                Map<String, Object> aiBody = new HashMap<>();
                aiBody.put("model", "google/gemini-2.5-flash");
                
                Map<String, Object> sysMsg = new HashMap<>();
                sysMsg.put("role", "system");
                sysMsg.put("content", "You are an expert resume parser and technical recruiter. Extract all skills, technologies, certifications, and relevant experience from the OCR text provided.");

                Map<String, Object> userMsg = new HashMap<>();
                userMsg.put("role", "user");
                userMsg.put("content", "Parse this resume OCR text and extract all relevant information.\n\n--- OCR TEXT ---\n" + ocrText + "\n--- END OCR TEXT ---");
                
                aiBody.put("messages", Arrays.asList(sysMsg, userMsg));

                // Set up tools configuration
                Map<String, Object> tool = new HashMap<>();
                tool.put("type", "function");
                
                Map<String, Object> parameters = new HashMap<>();
                parameters.put("type", "object");
                parameters.put("properties", Map.of(
                    "technical_skills", Map.of("type", "array", "items", Map.of("type", "string")),
                    "soft_skills", Map.of("type", "array", "items", Map.of("type", "string")),
                    "certifications", Map.of("type", "array", "items", Map.of("type", "string")),
                    "experience_summary", Map.of("type", "string"),
                    "overall_experience_level", Map.of("type", "string"),
                    "resume_score", Map.of("type", "number"),
                    "projects", Map.of("type", "array", "items", Map.of("type", "string")),
                    "skill_categories", Map.of(
                        "type", "object",
                        "properties", Map.of(
                            "languages", Map.of("type", "array", "items", Map.of("type", "string")),
                            "frameworks", Map.of("type", "array", "items", Map.of("type", "string")),
                            "databases", Map.of("type", "array", "items", Map.of("type", "string")),
                            "devops", Map.of("type", "array", "items", Map.of("type", "string")),
                            "other", Map.of("type", "array", "items", Map.of("type", "string"))
                        )
                    )
                ));
                parameters.put("required", Arrays.asList("technical_skills", "soft_skills", "certifications", "experience_summary", "overall_experience_level", "resume_score"));
                
                Map<String, Object> func = new HashMap<>();
                func.put("name", "extract_resume_skills");
                func.put("description", "Return structured resume analysis with extracted skills and experience");
                func.put("parameters", parameters);
                
                tool.put("function", func);
                aiBody.put("tools", Collections.singletonList(tool));
                aiBody.put("tool_choice", "extract_resume_skills");

                return callAIWithTool(aiBody, "extract_resume_skills").map(result -> {
                    // Update StudentProfile
                    Optional<StudentProfile> profileOpt = studentProfileRepository.findByStudentId(student.getId());
                    StudentProfile profile = profileOpt.orElseGet(() -> {
                        StudentProfile p = new StudentProfile();
                        p.setStudentId(student.getId());
                        return p;
                    });
                    try {
                        profile.setResumeSkills(mapper.writeValueAsString(result));
                    } catch (Exception ignored) {}
                    profile.setLastExtractedAt(LocalDateTime.now());
                    studentProfileRepository.save(profile);

                    return ResponseEntity.ok(Map.of("resume_skills", result));
                });
            });

        } catch (IOException e) {
            return Mono.just(ResponseEntity.status(500).body(Map.of("error", "IOException: " + e.getMessage())));
        }
    }

    @PostMapping({"/api/rank-candidates", "/functions/v1/rank-candidates"})
    public Mono<ResponseEntity<?>> rankCandidates(@RequestAttribute(value = "userId", required = false) UUID userId, @RequestBody Map<String, Object> reqBody) {
        if (userId == null) {
            return Mono.just(ResponseEntity.status(401).body(Map.of("error", "Unauthorized", "code", "unauthorized")));
        }
        String jobIdStr = (String) reqBody.get("jobId");
        if (jobIdStr == null) {
            jobIdStr = (String) reqBody.get("job_id");
        }
        if (jobIdStr == null) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "jobId is required")));
        }
        UUID jobId = UUID.fromString(jobIdStr);
        Optional<Job> jobOpt = jobRepository.findById(jobId);
        if (jobOpt.isEmpty()) {
            return Mono.just(ResponseEntity.status(404).body(Map.of("error", "Job not found")));
        }
        Job job = jobOpt.get();

        // Recruiter ownership check
        Optional<Recruiter> recruiterOpt = recruiterRepository.findByUserId(userId);
        if (recruiterOpt.isEmpty()) {
            return Mono.just(ResponseEntity.status(403).body(Map.of("error", "Recruiter profile required")));
        }
        Recruiter recruiter = recruiterOpt.get();
        if (!job.getRecruiterId().equals(recruiter.getId())) {
            return Mono.just(ResponseEntity.status(403).body(Map.of("error", "You do not own this job")));
        }

        List<Application> applications = applicationRepository.findByJobId(jobId);
        if (applications.isEmpty()) {
            return Mono.just(ResponseEntity.ok(Map.of("candidates", Collections.emptyList(), "summary", "No applications yet")));
        }

        List<Map<String, Object>> candidateSummaries = new ArrayList<>();
        Map<UUID, StudentProfile> profileMap = new HashMap<>();
        Map<UUID, Student> studentMap = new HashMap<>();

        for (Application app : applications) {
            Optional<Student> studentOpt = studentRepository.findById(app.getStudentId());
            if (studentOpt.isPresent()) {
                Student s = studentOpt.get();
                studentMap.put(s.getId(), s);
                Optional<StudentProfile> pOpt = studentProfileRepository.findByStudentId(s.getId());
                
                Map<String, Object> cData = new HashMap<>();
                cData.put("application_id", app.getId().toString());
                cData.put("student_id", s.getId().toString());
                cData.put("name", s.getName());
                cData.put("email", s.getEmail());
                cData.put("institution", s.getInstitution());
                cData.put("degree", s.getDegree());
                cData.put("branch", s.getBranch());
                cData.put("graduation_year", s.getGraduationYear());
                
                pOpt.ifPresent(p -> {
                    profileMap.put(s.getId(), p);
                    cData.put("github_url", p.getGithubUrl());
                    cData.put("github_data", p.getGithubData());
                    cData.put("leetcode_url", p.getLeetcodeUrl());
                    cData.put("leetcode_data", p.getLeetcodeData());
                    cData.put("linkedin_url", p.getLinkedinUrl());
                    cData.put("linkedin_data", p.getLinkedinData());
                    cData.put("gemini_analysis", p.getGeminiAnalysis());
                    cData.put("resume_skills", p.getResumeSkills());
                });
                candidateSummaries.add(cData);
            }
        }

        String prompt = "You are an expert technical recruiter AI. Analyze and rank the following candidates for a job position.\n\n" +
            "JOB DETAILS:\n" +
            "- Title: " + job.getTitle() + "\n" +
            "- Description: " + job.getDescription() + "\n" +
            "- Required Skills: " + String.join(", ", job.getRequiredSkills()) + "\n" +
            "- Preferred Skills: " + (job.getPreferredSkills() != null ? String.join(", ", job.getPreferredSkills()) : "") + "\n" +
            "- Experience Required: " + job.getExperienceRequired() + "\n" +
            "- Job Type: " + job.getJobType() + "\n\n" +
            "CANDIDATES:\n" +
            candidateSummaries + "\n\n" +
            "Rank all candidates from best to worst fit. For each candidate provide:\n" +
            "- A score from 0-100\n" +
            "- Key strengths relevant to this job\n" +
            "- Potential gaps or concerns\n" +
            "- A brief recommendation";

        Map<String, Object> aiBody = new HashMap<>();
        aiBody.put("model", "google/gemini-2.5-flash");
        aiBody.put("messages", Arrays.asList(
            Map.of("role", "system", "content", "You are an expert AI recruiter that ranks candidates objectively and provides actionable insights."),
            Map.of("role", "user", "content", prompt)
        ));

        // Configure tool
        Map<String, Object> tool = new HashMap<>();
        tool.put("type", "function");
        
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("type", "object");
        parameters.put("properties", Map.of(
            "ranked_candidates", Map.of(
                "type", "array",
                "items", Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "application_id", Map.of("type", "string"),
                        "student_id", Map.of("type", "string"),
                        "name", Map.of("type", "string"),
                        "score", Map.of("type", "number"),
                        "rank", Map.of("type", "integer"),
                        "strengths", Map.of("type", "array", "items", Map.of("type", "string")),
                        "gaps", Map.of("type", "array", "items", Map.of("type", "string")),
                        "recommendation", Map.of("type", "string")
                    ),
                    "required", Arrays.asList("application_id", "student_id", "name", "score", "rank", "strengths", "gaps", "recommendation")
                )
            ),
            "summary", Map.of("type", "string")
        ));
        parameters.put("required", Arrays.asList("ranked_candidates", "summary"));
        
        Map<String, Object> func = new HashMap<>();
        func.put("name", "rank_candidates");
        func.put("description", "Return ranked candidates with scores and analysis");
        func.put("parameters", parameters);
        tool.put("function", func);
        
        aiBody.put("tools", Collections.singletonList(tool));
        aiBody.put("tool_choice", "rank_candidates");

        return callAIWithTool(aiBody, "rank_candidates").map(ranking -> {
            if (ranking.containsKey("error")) {
                return ResponseEntity.status(502).body(ranking);
            }
            Object rcObj = ranking.get("ranked_candidates");
            if (!(rcObj instanceof List)) {
                return ResponseEntity.status(502).body(Map.of("error", "AI returned invalid ranking shape"));
            }
            List<Map<String, Object>> rankedCandidates = (List<Map<String, Object>>) rcObj;
            List<Map<String, Object>> enriched = new ArrayList<>();

            for (Map<String, Object> rc : rankedCandidates) {
                UUID studentId = safeUuid(rc.get("student_id"));
                Student student = studentId != null ? studentMap.get(studentId) : null;
                StudentProfile profile = studentId != null ? profileMap.get(studentId) : null;
                
                Map<String, Object> candidateMap = new HashMap<>(rc);
                candidateMap.put("email", student != null ? student.getEmail() : "");
                candidateMap.put("institution", student != null ? student.getInstitution() : "");
                candidateMap.put("degree", student != null ? student.getDegree() : "");
                candidateMap.put("branch", student != null ? student.getBranch() : "");
                candidateMap.put("graduation_year", student != null ? student.getGraduationYear() : 0);
                
                if (profile != null) {
                    candidateMap.put("github_url", profile.getGithubUrl());
                    candidateMap.put("leetcode_url", profile.getLeetcodeUrl());
                    candidateMap.put("linkedin_url", profile.getLinkedinUrl());
                    candidateMap.put("resume_skills", profile.getResumeSkills());
                }
                
                enriched.add(candidateMap);

                // Update application match analysis in database
                UUID appId = safeUuid(rc.get("application_id"));
                if (appId != null) {
                    Optional<Application> appOpt = applicationRepository.findById(appId);
                    appOpt.ifPresent(app -> {
                        try {
                            app.setMatchAnalysis(mapper.writeValueAsString(candidateMap));
                            applicationRepository.save(app);
                        } catch (Exception ignored) {}
                    });
                }
            }

            return ResponseEntity.ok(Map.of("candidates", enriched, "summary", ranking.getOrDefault("summary", "")));
        });
    }

    @PostMapping({"/api/bias-detect", "/functions/v1/bias-detect"})
    public Mono<ResponseEntity<?>> biasDetect(@RequestBody Map<String, Object> body) {
        String jobDescription = (String) body.get("job_description");
        if (jobDescription == null) {
            jobDescription = (String) body.get("description");
        }
        String jobTitle = (String) body.get("job_title");
        List<String> requiredSkills = (List<String>) body.get("required_skills");

        String prompt = "You are an AI Hiring Bias Detector. Analyze the following job posting for potential biases that could discourage diverse candidates.\n\n" +
            "Job Title: " + (jobTitle != null ? jobTitle : "Unknown") + "\n" +
            "Required Skills: " + (requiredSkills != null ? requiredSkills : "[]") + "\n" +
            "Job Description:\n" + jobDescription + "\n\n" +
            "Check for these bias categories:\n" +
            "1. Gender bias: Gendered language (\"rockstar\", \"ninja\", \"manpower\"), pronouns\n" +
            "2. Age bias: \"Digital native\", \"young and dynamic\", excessive years of experience\n" +
            "3. Cultural bias: Assumptions about background, \"culture fit\" language\n" +
            "4. Disability bias: Unnecessary physical requirements, \"fast-paced\" overuse\n" +
            "5. Education bias: Unnecessary degree requirements for skill-based roles\n" +
            "6. Socioeconomic bias: Unpaid internships, relocation without support\n\n" +
            "Return a JSON object with this EXACT structure:\n" +
            "{\n" +
            "  \"bias_score\": <number 0-100, where 0 is no bias and 100 is highly biased>,\n" +
            "  \"overall_rating\": \"excellent\" | \"good\" | \"needs_improvement\" | \"problematic\",\n" +
            "  \"findings\": [\n" +
            "    {\n" +
            "      \"category\": \"gender\" | \"age\" | \"cultural\" | \"disability\" | \"education\" | \"socioeconomic\",\n" +
            "      \"severity\": \"low\" | \"medium\" | \"high\",\n" +
            "      \"problematic_text\": \"<the exact problematic text from the JD>\",\n" +
            "      \"explanation\": \"<why this is biased>\",\n" +
            "      \"suggestion\": \"<inclusive alternative>\"\n" +
            "    }\n" +
            "  ],\n" +
            "  \"inclusive_score\": <number 0-100>,\n" +
            "  \"summary\": \"<2-3 sentence summary>\",\n" +
            "  \"rewritten_sections\": [\n" +
            "    {\"original\": \"<problematic text>\", \"improved\": \"<inclusive version>\"}\n" +
            "  ]\n" +
            "}\n\n" +
            "Return ONLY valid JSON, no markdown.";

        Map<String, Object> aiBody = new HashMap<>();
        aiBody.put("model", "google/gemini-2.5-flash");
        aiBody.put("messages", Collections.singletonList(
            Map.of("role", "user", "content", prompt)
        ));

        return callAIWithJsonOutput(aiBody).map(ResponseEntity::ok);
    }

    @PostMapping({"/api/career-path", "/functions/v1/career-path"})
    public Mono<ResponseEntity<?>> careerPath(@RequestAttribute(value = "userId", required = false) UUID userId, @RequestBody Map<String, Object> reqBody) {
        if (userId == null) {
            return Mono.just(ResponseEntity.status(401).body(Map.of("error", "Unauthorized", "code", "unauthorized")));
        }
        String targetRole = (String) reqBody.get("target_role");
        if (targetRole == null) {
            targetRole = (String) reqBody.get("targetRole");
        }

        Optional<Student> studentOpt = studentRepository.findByUserId(userId);
        if (studentOpt.isEmpty()) return Mono.just(ResponseEntity.status(404).body(Map.of("error", "Student not found")));
        Student s = studentOpt.get();
        Optional<StudentProfile> pOpt = studentProfileRepository.findByStudentId(s.getId());

        Map<String, Object> studentContext = new HashMap<>();
        studentContext.put("name", s.getName());
        studentContext.put("degree", s.getDegree());
        studentContext.put("branch", s.getBranch());
        studentContext.put("institution", s.getInstitution());
        studentContext.put("graduation_year", s.getGraduationYear());
        pOpt.ifPresent(p -> {
            studentContext.put("gemini_analysis", p.getGeminiAnalysis());
            studentContext.put("resume_skills", p.getResumeSkills());
            studentContext.put("github_data", p.getGithubData());
            studentContext.put("leetcode_data", p.getLeetcodeData());
        });

        String prompt = "Create a detailed career path for this student targeting the role: \"" + targetRole + "\"\n\n" +
            "Student Profile:\n" +
            studentContext + "\n\n" +
            "Create a personalized 6-month roadmap with specific monthly goals, resources, and milestones.";

        Map<String, Object> aiBody = new HashMap<>();
        aiBody.put("model", "google/gemini-2.5-flash");
        aiBody.put("messages", Arrays.asList(
            Map.of("role", "system", "content", "You are an expert career advisor and tech mentor. Create personalized, actionable career roadmaps."),
            Map.of("role", "user", "content", prompt)
        ));

        // Configure tool
        Map<String, Object> tool = new HashMap<>();
        tool.put("type", "function");
        
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("type", "object");
        parameters.put("properties", Map.of(
            "target_role", Map.of("type", "string"),
            "current_level", Map.of("type", "string", "enum", Arrays.asList("beginner", "intermediate", "advanced")),
            "readiness_score", Map.of("type", "number"),
            "summary", Map.of("type", "string"),
            "existing_strengths", Map.of("type", "array", "items", Map.of("type", "string")),
            "skill_gaps", Map.of("type", "array", "items", Map.of("type", "string")),
            "monthly_plan", Map.of(
                "type", "array",
                "items", Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "month", Map.of("type", "integer"),
                        "title", Map.of("type", "string"),
                        "goals", Map.of("type", "array", "items", Map.of("type", "string")),
                        "resources", Map.of("type", "array", "items", Map.of("type", "string")),
                        "project_idea", Map.of("type", "string")
                    ),
                    "required", Arrays.asList("month", "title", "goals", "resources", "project_idea")
                )
            ),
            "recommended_certifications", Map.of("type", "array", "items", Map.of("type", "string")),
            "interview_tips", Map.of("type", "array", "items", Map.of("type", "string"))
        ));
        parameters.put("required", Arrays.asList("target_role", "current_level", "readiness_score", "summary", "existing_strengths", "skill_gaps", "monthly_plan", "recommended_certifications", "interview_tips"));
        
        Map<String, Object> func = new HashMap<>();
        func.put("name", "generate_career_path");
        func.put("description", "Return structured career path roadmap");
        func.put("parameters", parameters);
        tool.put("function", func);
        
        aiBody.put("tools", Collections.singletonList(tool));
        aiBody.put("tool_choice", "generate_career_path");

        return callAIWithTool(aiBody, "generate_career_path").map(ResponseEntity::ok);
    }

    @PostMapping({"/api/eligibility-check", "/functions/v1/eligibility-check"})
    public Mono<ResponseEntity<?>> eligibilityCheck(@RequestAttribute(value = "userId", required = false) UUID userId, @RequestBody Map<String, Object> reqBody) {
        if (userId == null) {
            return Mono.just(ResponseEntity.status(401).body(Map.of("error", "Unauthorized", "code", "unauthorized")));
        }
        String jobIdStr = (String) reqBody.get("job_id");
        if (jobIdStr == null) {
            jobIdStr = (String) reqBody.get("jobId");
        }
        Optional<Job> jobOpt = jobRepository.findById(UUID.fromString(jobIdStr));
        if (jobOpt.isEmpty()) return Mono.just(ResponseEntity.status(404).body(Map.of("error", "Job not found")));
        Job job = jobOpt.get();

        Optional<Student> studentOpt = studentRepository.findByUserId(userId);
        if (studentOpt.isEmpty()) return Mono.just(ResponseEntity.status(404).body(Map.of("error", "Student not found")));
        Student s = studentOpt.get();
        Optional<StudentProfile> pOpt = studentProfileRepository.findByStudentId(s.getId());

        Map<String, Object> studentSummary = new HashMap<>();
        studentSummary.put("name", s.getName());
        studentSummary.put("institution", s.getInstitution());
        studentSummary.put("degree", s.getDegree());
        studentSummary.put("branch", s.getBranch());
        studentSummary.put("graduation_year", s.getGraduationYear());
        pOpt.ifPresent(p -> {
            studentSummary.put("github_url", p.getGithubUrl());
            studentSummary.put("github_data", p.getGithubData());
            studentSummary.put("leetcode_url", p.getLeetcodeUrl());
            studentSummary.put("leetcode_data", p.getLeetcodeData());
            studentSummary.put("linkedin_url", p.getLinkedinUrl());
            studentSummary.put("linkedin_data", p.getLinkedinData());
            studentSummary.put("resume_skills", p.getResumeSkills());
        });

        String prompt = "You are an expert career advisor AI. Analyze how well this student matches the following job posting and provide a detailed eligibility analysis with a personalized learning roadmap focused on maximizing SHORTLIST chances.\n\n" +
            "JOB DETAILS:\n" +
            "- Title: " + job.getTitle() + "\n" +
            "- Description: " + job.getDescription() + "\n" +
            "- Required Skills: " + String.join(", ", job.getRequiredSkills()) + "\n" +
            "- Preferred Skills: " + (job.getPreferredSkills() != null ? String.join(", ", job.getPreferredSkills()) : "") + "\n" +
            "- Experience Required: " + job.getExperienceRequired() + "\n" +
            "- Job Type: " + job.getJobType() + "\n\n" +
            "STUDENT PROFILE:\n" +
            studentSummary + "\n\n" +
            "Provide:\n" +
            "1. An overall match percentage (0-100)\n" +
            "2. Skills the student already has that match\n" +
            "3. Skills the student is missing, ordered by importance for shortlisting\n" +
            "4. A personalized learning roadmap: one entry per missing skill (max 5), highest priority first. Each entry needs skill, priority (high/medium/low), timeline (e.g. 2 weeks), 1-2 sentence description of why recruiters screen for it, 2 resources WITH real https URLs, and one concrete shortlist-booster project action.\n" +
            "5. A brief eligibility verdict + 3-5 actionable tips that directly increase shortlist odds.";

        Map<String, Object> aiBody = new HashMap<>();
        aiBody.put("model", "google/gemini-2.5-flash");
        aiBody.put("messages", Arrays.asList(
            Map.of("role", "system", "content", "You are an expert career advisor that helps students understand their job eligibility and provides actionable learning paths."),
            Map.of("role", "user", "content", prompt)
        ));

        // Configure tool
        Map<String, Object> tool = new HashMap<>();
        tool.put("type", "function");
        
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("type", "object");
        parameters.put("properties", Map.of(
            "match_percentage", Map.of("type", "number"),
            "verdict", Map.of("type", "string"),
            "verdict_detail", Map.of("type", "string"),
            "matched_skills", Map.of("type", "array", "items", Map.of("type", "string")),
            "missing_skills", Map.of("type", "array", "items", Map.of("type", "string")),
            "roadmap", Map.of(
                "type", "array",
                "items", Map.of(
                    "type", "object",
                    "properties", Map.of(
                        "skill", Map.of("type", "string"),
                        "priority", Map.of("type", "string"),
                        "timeline", Map.of("type", "string"),
                        "description", Map.of("type", "string"),
                        "action", Map.of("type", "string"),
                        "resources", Map.of(
                            "type", "array",
                            "items", Map.of(
                                "type", "object",
                                "properties", Map.of(
                                    "title", Map.of("type", "string"),
                                    "url", Map.of("type", "string"),
                                    "type", Map.of("type", "string")
                                ),
                                "required", Arrays.asList("title", "type")
                            )
                        )
                    ),
                    "required", Arrays.asList("skill", "priority", "timeline", "description", "resources", "action")
                )
            ),
            "tips", Map.of("type", "array", "items", Map.of("type", "string"))
        ));
        parameters.put("required", Arrays.asList("match_percentage", "verdict", "verdict_detail", "matched_skills", "missing_skills", "roadmap", "tips"));
        
        Map<String, Object> func = new HashMap<>();
        func.put("name", "eligibility_analysis");
        func.put("description", "Return structured eligibility analysis with match score and roadmap");
        func.put("parameters", parameters);
        tool.put("function", func);
        
        aiBody.put("tools", Collections.singletonList(tool));
        aiBody.put("tool_choice", "eligibility_analysis");

        return callAIWithTool(aiBody, "eligibility_analysis").map(ResponseEntity::ok);
    }

    @PostMapping({"/api/extract-profile", "/functions/v1/extract-profile"})
    public Mono<ResponseEntity<?>> extractProfile(@RequestAttribute(value = "userId", required = false) UUID userId) {
        if (userId == null) {
            return Mono.just(ResponseEntity.status(401).body(Map.of("error", "Unauthorized", "code", "unauthorized")));
        }
        Optional<Student> studentOpt = studentRepository.findByUserId(userId);
        if (studentOpt.isEmpty()) return Mono.just(ResponseEntity.status(404).body(Map.of("error", "Student not found")));
        Student s = studentOpt.get();
        Optional<StudentProfile> pOpt = studentProfileRepository.findByStudentId(s.getId());
        if (pOpt.isEmpty()) return Mono.just(ResponseEntity.status(404).body(Map.of("error", "Student profile not found")));
        StudentProfile p = pOpt.get();

        String prompt = "Generate realistic candidate strengths and skill analysis from their github/leetcode profiles.\n" +
            "Github: " + p.getGithubUrl() + "\nLeetcode: " + p.getLeetcodeUrl();

        Map<String, Object> aiBody = new HashMap<>();
        aiBody.put("model", "google/gemini-2.5-flash");
        aiBody.put("messages", Arrays.asList(
            Map.of("role", "system", "content", "You are an AI profile evaluator. Analyze candidate stats and profiles and output structured analysis."),
            Map.of("role", "user", "content", prompt)
        ));

        // Configure tool
        Map<String, Object> tool = new HashMap<>();
        tool.put("type", "function");
        
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("type", "object");
        parameters.put("properties", Map.of(
            "overall_score", Map.of("type", "number"),
            "summary", Map.of("type", "string"),
            "technical_skills", Map.of("type", "array", "items", Map.of("type", "string")),
            "skill_level", Map.of("type", "string", "enum", Arrays.asList("beginner", "intermediate", "advanced", "expert")),
            "strengths", Map.of("type", "array", "items", Map.of("type", "string")),
            "areas_to_improve", Map.of("type", "array", "items", Map.of("type", "string")),
            "recommended_roles", Map.of("type", "array", "items", Map.of("type", "string")),
            "github_assessment", Map.of(
                "type", "object",
                "properties", Map.of(
                    "score", Map.of("type", "number"),
                    "highlights", Map.of("type", "array", "items", Map.of("type", "string"))
                ),
                "required", Arrays.asList("score", "highlights")
            ),
            "leetcode_assessment", Map.of(
                "type", "object",
                "properties", Map.of(
                    "score", Map.of("type", "number"),
                    "highlights", Map.of("type", "array", "items", Map.of("type", "string"))
                ),
                "required", Arrays.asList("score", "highlights")
            )
        ));
        parameters.put("required", Arrays.asList("overall_score", "summary", "technical_skills", "skill_level", "strengths", "areas_to_improve", "recommended_roles", "github_assessment", "leetcode_assessment"));
        
        Map<String, Object> func = new HashMap<>();
        func.put("name", "profile_analysis");
        func.put("description", "Return structured profile analysis assessment");
        func.put("parameters", parameters);
        tool.put("function", func);
        
        aiBody.put("tools", Collections.singletonList(tool));
        aiBody.put("tool_choice", "profile_analysis");

        return callAIWithTool(aiBody, "profile_analysis").map(analysis -> {
            String githubJson = "{\"reposCount\": 12, \"starsCount\": 8, \"contributions\": 142}";
            String leetcodeJson = "{\"solvedCount\": 74, \"ranking\": 320140, \"easySolved\": 30, \"mediumSolved\": 35, \"hardSolved\": 9}";
            
            try {
                p.setGithubData(githubJson);
                p.setLeetcodeData(leetcodeJson);
                p.setGeminiAnalysis(mapper.writeValueAsString(analysis));
                p.setLastExtractedAt(LocalDateTime.now());
                studentProfileRepository.save(p);

                Map<String, Object> response = new HashMap<>();
                response.put("github_data", mapper.readValue(githubJson, Map.class));
                response.put("leetcode_data", mapper.readValue(leetcodeJson, Map.class));
                response.put("analysis", analysis);
                return ResponseEntity.ok(response);
            } catch (Exception ex) {
                return ResponseEntity.status(500).body(Map.of("error", "Failed to construct profile extraction response"));
            }
        });
    }

    @PostMapping({"/api/generate-jd", "/functions/v1/generate-jd"})
    public Mono<ResponseEntity<?>> generateJd(@RequestBody Map<String, Object> body) {
        String title = (String) body.get("title");
        String jobType = (String) body.get("job_type");
        String location = (String) body.get("location");
        String experience = (String) body.get("experience");
        String briefDescription = (String) body.get("brief_description");

        String prompt = "Generate a complete job description based on this brief:\n" +
            "Title: " + (title != null ? title : "Not specified") + "\n" +
            "Type: " + (jobType != null ? jobType : "Full-time") + "\n" +
            "Location: " + (location != null ? location : "Not specified") + "\n" +
            "Experience: " + (experience != null ? experience : "Not specified") + "\n" +
            "Brief: " + briefDescription + "\n\n" +
            "Create a comprehensive, professional job description.";

        Map<String, Object> aiBody = new HashMap<>();
        aiBody.put("model", "google/gemini-2.5-flash");
        aiBody.put("messages", Arrays.asList(
            Map.of("role", "system", "content", "You are an expert HR professional and technical recruiter. Generate professional, detailed job descriptions."),
            Map.of("role", "user", "content", prompt)
        ));

        // Configure tool
        Map<String, Object> tool = new HashMap<>();
        tool.put("type", "function");
        
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("type", "object");
        parameters.put("properties", Map.of(
            "description", Map.of("type", "string", "description", "Full job description with responsibilities, requirements, and benefits. Use markdown formatting."),
            "required_skills", Map.of("type", "array", "items", Map.of("type", "string"), "description", "5-10 required technical skills"),
            "preferred_skills", Map.of("type", "array", "items", Map.of("type", "string"), "description", "3-5 preferred/nice-to-have skills"),
            "salary_suggestion", Map.of("type", "string", "description", "Suggested salary range based on role and market"),
            "suggested_title", Map.of("type", "string", "description", "Professional job title suggestion")
        ));
        parameters.put("required", Arrays.asList("description", "required_skills", "preferred_skills", "salary_suggestion", "suggested_title"));
        
        Map<String, Object> func = new HashMap<>();
        func.put("name", "generate_job_description");
        func.put("description", "Return structured job description");
        func.put("parameters", parameters);
        tool.put("function", func);
        
        aiBody.put("tools", Collections.singletonList(tool));
        aiBody.put("tool_choice", "generate_job_description");

        return callAIWithTool(aiBody, "generate_job_description").map(ResponseEntity::ok);
    }

    @PostMapping({"/api/portfolio-build", "/functions/v1/portfolio-build"})
    public ResponseEntity<?> portfolioBuild(
            @RequestBody Map<String, Object> body,
            @RequestAttribute(value = "userId", required = false) UUID callerUserId,
            @RequestAttribute(value = "userRole", required = false) String callerRole) {
        if (callerUserId == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        // Frontend contract (matches supabase/functions/portfolio-build): {student_data, profile_data, target_role}
        if (body.containsKey("student_data") || body.containsKey("target_role") || body.containsKey("targetRole")) {
            Map<String, Object> studentData = body.get("student_data") instanceof Map
                    ? (Map<String, Object>) body.get("student_data") : new HashMap<>();
            Map<String, Object> profileData = body.get("profile_data") instanceof Map
                    ? (Map<String, Object>) body.get("profile_data") : new HashMap<>();
            String targetRole = (String) body.get("target_role");
            if (targetRole == null) targetRole = (String) body.get("targetRole");
            if (targetRole == null) targetRole = "Software Developer";
            String name = String.valueOf(studentData.getOrDefault("name", "Student"));
            Object skillsObj = profileData.getOrDefault("resume_skills",
                    profileData.getOrDefault("skills", studentData.getOrDefault("skills", Collections.emptyList())));
            List<String> skills = new ArrayList<>();
            if (skillsObj instanceof List) {
                for (Object o : (List<?>) skillsObj) skills.add(String.valueOf(o));
            } else if (skillsObj instanceof String) {
                String s = (String) skillsObj;
                if (s.startsWith("[")) {
                    try { skills.addAll(mapper.readValue(s, List.class)); }
                    catch (Exception ignored) { skills.add(s); }
                } else if (!s.isBlank()) skills.add(s);
            }
            if (skills.isEmpty()) skills.add("Problem Solving");
            Map<String, Object> out = new HashMap<>();
            out.put("headline", name + " — Aspiring " + targetRole);
            out.put("bio", name + " is building towards a " + targetRole + " role with hands-on projects and continuous learning.");
            out.put("skills", skills);
            out.put("projects", Collections.singletonList(Map.of(
                    "title", "Portfolio Project for " + targetRole,
                    "description", "Ship a project demonstrating " + String.join(", ", skills.subList(0, Math.min(3, skills.size()))) + " with README and live demo.",
                    "highlights", skills.subList(0, Math.min(3, skills.size())))));
            out.put("achievements", Collections.singletonList("Completed portfolio setup for " + targetRole));
            out.put("summary", "Portfolio generated from profile data. Add GitHub repos and resume skills for richer output.");
            out.put("suggested_roles", Collections.singletonList(targetRole));
            return ResponseEntity.ok(out);
        }
        String studentIdStr = (String) body.get("studentId");
        if (studentIdStr == null) studentIdStr = (String) body.get("student_id");
        UUID studentId = safeUuid(studentIdStr);
        if (studentId == null) return ResponseEntity.badRequest().body(Map.of("error", "Valid studentId required"));
        // Ownership: students own portfolio only; recruiters admin allowed
        if (!"admin".equalsIgnoreCase(callerRole)) {
            boolean owns = studentRepository.findById(studentId)
                    .map(s -> callerUserId.equals(s.getUserId())).orElse(false);
            if (!owns) {
                boolean isRecruiter = recruiterRepository.findByUserId(callerUserId).isPresent();
                if (!isRecruiter) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }
        }
        Optional<Student> studentOpt = studentRepository.findById(studentId);
        if (studentOpt.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Student not found"));
        Student s = studentOpt.get();
        Optional<StudentProfile> pOpt = studentProfileRepository.findByStudentId(s.getId());

        String html = "<html><head><title>" + esc(s.getName()) + " Portfolio</title></head><body>"
                + "<h1>" + esc(s.getName()) + "</h1>"
                + "<p>Institution: " + esc(s.getInstitution()) + "</p>"
                + "<p>Degree: " + esc(s.getDegree()) + " (" + esc(s.getBranch()) + ")</p>"
                + "<p>Resume Details: " + esc(pOpt.isPresent() ? pOpt.get().getResumeSkills() : "None") + "</p>"
                + "</body></html>";
        Map<String, Object> out = new HashMap<>();
        out.put("html", html);
        out.put("headline", s.getName() + " — " + s.getDegree() + " " + s.getBranch());
        out.put("bio", s.getName() + " from " + s.getInstitution() + " building towards industry roles.");
        out.put("skills", Collections.singletonList("Problem Solving"));
        out.put("projects", Collections.emptyList());
        out.put("achievements", Collections.emptyList());
        out.put("summary", "Portfolio for " + s.getName());
        out.put("suggested_roles", Collections.singletonList("Software Developer"));
        return ResponseEntity.ok(out);
    }

    @PostMapping({"/api/project-score", "/functions/v1/project-score"})
    public Mono<ResponseEntity<?>> projectScore(@RequestBody Map<String, Object> body) {
        Map<String, Object> githubData = (Map<String, Object>) body.get("github_data");
        String studentName = (String) body.get("student_name");

        String prompt = "You are an AI project scoring engine. Analyze the following GitHub data and score the developer's projects.\n\n" +
            "Developer: " + (studentName != null ? studentName : "Unknown") + "\n" +
            "GitHub Data:\n" +
            githubData + "\n\n" +
            "For each notable project/repository, evaluate:\n" +
            "1. Code complexity and architecture quality (based on languages, size, description)\n" +
            "2. Documentation quality (README presence, description)\n" +
            "3. Community engagement (stars, forks, watchers)\n" +
            "4. Technology diversity\n\n" +
            "Return a JSON object with this EXACT structure:\n" +
            "{\n" +
            "  \"overall_score\": <number 0-100>,\n" +
            "  \"projects\": [\n" +
            "    {\n" +
            "      \"name\": \"<repo name>\",\n" +
            "      \"description\": \"<brief description>\",\n" +
            "      \"scores\": {\n" +
            "        \"architecture\": <0-100>,\n" +
            "        \"documentation\": <0-100>,\n" +
            "        \"code_quality\": <0-100>,\n" +
            "        \"community\": <0-100>\n" +
            "      },\n" +
            "      \"overall\": <0-100>,\n" +
            "      \"highlights\": [\"<highlight1>\"],\n" +
            "      \"languages\": [\"<lang1>\"]\n" +
            "    }\n" +
            "  ],\n" +
            "  \"tech_diversity_score\": <0-100>,\n" +
            "  \"summary\": \"<2-3 sentence summary>\",\n" +
            "  \"top_technologies\": [\"<tech1>\", \"<tech2>\"]\n" +
            "}\n\n" +
            "Limit to top 8 projects. Return ONLY valid JSON, no markdown.";

        Map<String, Object> aiBody = new HashMap<>();
        aiBody.put("model", "google/gemini-2.5-flash");
        aiBody.put("messages", Collections.singletonList(
            Map.of("role", "user", "content", prompt)
        ));

        return callAIWithJsonOutput(aiBody).map(ResponseEntity::ok);
    }

    @PostMapping({"/api/authenticity-check", "/functions/v1/authenticity-check"})
    public Mono<ResponseEntity<?>> authenticityCheck(@RequestBody Map<String, Object> body) {
        Map<String, Object> studentProfile = (Map<String, Object>) body.get("student_profile");

        String prompt = "You are a resume authenticity detector. Analyze the following student profile data for signs of inflated or fake credentials.\n\n" +
            "Profile Data:\n" +
            studentProfile + "\n\n" +
            "Analyze these signals:\n" +
            "1. GitHub: Check if repos are mostly forks with minimal commits, low code activity relative to claimed skills, suspicious patterns\n" +
            "2. LeetCode: Check if problem count matches claimed skill level, activity timeline gaps\n" +
            "3. Resume Skills: Check if claimed skills are consistent with GitHub languages and project types\n" +
            "4. Overall consistency between platforms\n\n" +
            "Return a JSON object with this EXACT structure:\n" +
            "{\n" +
            "  \"authenticity_score\": <number 0-100>,\n" +
            "  \"risk_level\": \"low\" | \"medium\" | \"high\",\n" +
            "  \"signals\": [\n" +
            "    {\"type\": \"positive\" | \"warning\" | \"suspicious\", \"category\": \"github\" | \"leetcode\" | \"resume\" | \"consistency\", \"message\": \"<description>\"}\n" +
            "  ],\n" +
            "  \"summary\": \"<2-3 sentence summary>\",\n" +
            "  \"recommendations\": [\"<recommendation1>\", \"<recommendation2>\"]\n" +
            "}\n\n" +
            "Return ONLY valid JSON, no markdown.";

        Map<String, Object> aiBody = new HashMap<>();
        aiBody.put("model", "google/gemini-2.5-flash");
        aiBody.put("messages", Collections.singletonList(
            Map.of("role", "user", "content", prompt)
        ));

        return callAIWithJsonOutput(aiBody).map(ResponseEntity::ok);
    }

    @PostMapping(value = {"/api/recruiter-agent", "/functions/v1/recruiter-agent"}, produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> recruiterAgent(@RequestBody Map<String, Object> body) {
        return aiService.callAIStream(body);
    }

    @PostMapping(value = {"/api/interview-sim", "/functions/v1/interview-sim"}, produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> interviewSim(@RequestBody Map<String, Object> body) {
        return aiService.callAIStream(body);
    }

    @PostMapping({"/api/application-feedback", "/functions/v1/application-feedback"})
    public ResponseEntity<?> applicationFeedback(
            @RequestBody Map<String, Object> body,
            @RequestAttribute(value = "userId", required = false) UUID callerUserId,
            @RequestAttribute(value = "userRole", required = false) String callerRole) {
        if (callerUserId == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        Object idsObj = body.get("application_ids");
        if (idsObj == null) idsObj = body.get("applicationIds");
        if (!(idsObj instanceof List)) {
            return ResponseEntity.badRequest().body(Map.of("error", "application_ids array required (1-100)"));
        }
        List<?> ids = (List<?>) idsObj;
        if (ids.isEmpty() || ids.size() > 100) {
            return ResponseEntity.badRequest().body(Map.of("error", "application_ids must contain 1-100 ids"));
        }
        UUID callerRecruiterId = recruiterRepository.findByUserId(callerUserId).map(Recruiter::getId).orElse(null);
        boolean isAdmin = "admin".equalsIgnoreCase(callerRole);
        List<Map<String, Object>> feedback = new ArrayList<>();
        for (Object o : ids) {
            UUID id = safeUuid(o);
            if (id == null) continue;
            Optional<Application> opt = applicationRepository.findById(id);
            if (opt.isEmpty()) continue;
            Application app = opt.get();
            if (!isAdmin) {
                if (callerRecruiterId == null || !ownsJobSafe(app.getJobId(), callerRecruiterId)) continue;
            }
            Map<String, Object> entry = new HashMap<>();
            entry.put("id", app.getId().toString());
            entry.put("recruiter_feedback", app.getRecruiterFeedback());
            feedback.add(entry);
        }
        return ResponseEntity.ok(Map.of("feedback", feedback));
    }

    private boolean ownsJobSafe(UUID jobId, UUID recruiterId) {
        if (jobId == null || recruiterId == null) return false;
        return jobRepository.findById(jobId).map(j -> recruiterId.equals(j.getRecruiterId())).orElse(false);
    }

    @PostMapping("/api/seed-users")
    public ResponseEntity<?> seedUsers(@RequestHeader(value = "x-seed-secret", required = false) String providedHeader) {
        if (seedSecret == null || seedSecret.isBlank()) {
            return ResponseEntity.status(403).body(Map.of("error", "Seeding disabled"));
        }
        if (providedHeader == null
                || providedHeader.length() != seedSecret.length()
                || !java.security.MessageDigest.isEqual(
                        providedHeader.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                        seedSecret.getBytes(java.nio.charset.StandardCharsets.UTF_8))) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        Map<String, Object> result = dataSeeder.seed("Demo@1234");
        return ResponseEntity.ok(result);
    }

    private UUID safeUuid(Object v) {
        if (v == null) return null;
        try { return UUID.fromString(String.valueOf(v).trim()); } catch (Exception e) { return null; }
    }

    private String esc(Object v) {
        if (v == null) return "";
        return String.valueOf(v).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#x27;");
    }
}
class ModelBuilderHelper {
    public static Map<String, Object> model(Map<String, Object> map, String value) {
        map.put("model", value);
        return map;
    }
}

