package com.sudheeai.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "student_profiles")
public class StudentProfile {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "student_id", unique = true, nullable = false)
    private UUID studentId;

    @Column(name = "leetcode_url")
    private String leetcodeUrl;

    @Column(name = "github_url")
    private String githubUrl;

    @Column(name = "linkedin_url")
    private String linkedinUrl;

    @Column(name = "leetcode_data", columnDefinition = "TEXT")
    private String leetcodeData = "{}";

    @Column(name = "github_data", columnDefinition = "TEXT")
    private String githubData = "{}";

    @Column(name = "linkedin_data", columnDefinition = "TEXT")
    private String linkedinData = "{}";

    @Column(name = "gemini_analysis", columnDefinition = "TEXT")
    private String geminiAnalysis = "{}";

    @Column(name = "resume_skills", columnDefinition = "TEXT")
    private String resumeSkills = "{}";

    @Column(name = "last_extracted_at")
    private LocalDateTime lastExtractedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public StudentProfile() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getStudentId() { return studentId; }
    public void setStudentId(UUID studentId) { this.studentId = studentId; }
    public String getLeetcodeUrl() { return leetcodeUrl; }
    public void setLeetcodeUrl(String leetcodeUrl) { this.leetcodeUrl = leetcodeUrl; }
    public String getGithubUrl() { return githubUrl; }
    public void setGithubUrl(String githubUrl) { this.githubUrl = githubUrl; }
    public String getLinkedinUrl() { return linkedinUrl; }
    public void setLinkedinUrl(String linkedinUrl) { this.linkedinUrl = linkedinUrl; }
    public String getLeetcodeData() { return leetcodeData; }
    public void setLeetcodeData(String leetcodeData) { this.leetcodeData = leetcodeData; }
    public String getGithubData() { return githubData; }
    public void setGithubData(String githubData) { this.githubData = githubData; }
    public String getLinkedinData() { return linkedinData; }
    public void setLinkedinData(String linkedinData) { this.linkedinData = linkedinData; }
    public String getGeminiAnalysis() { return geminiAnalysis; }
    public void setGeminiAnalysis(String geminiAnalysis) { this.geminiAnalysis = geminiAnalysis; }
    public String getResumeSkills() { return resumeSkills; }
    public void setResumeSkills(String resumeSkills) { this.resumeSkills = resumeSkills; }
    public LocalDateTime getLastExtractedAt() { return lastExtractedAt; }
    public void setLastExtractedAt(LocalDateTime lastExtractedAt) { this.lastExtractedAt = lastExtractedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
