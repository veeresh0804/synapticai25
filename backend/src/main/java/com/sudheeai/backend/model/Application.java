package com.sudheeai.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "applications", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"job_id", "student_id"})
})
public class Application {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "job_id", nullable = false)
    private UUID jobId;

    @Column(name = "student_id", nullable = false)
    private UUID studentId;

    @Column(nullable = false)
    private String status = "pending"; // "pending", "under_review", "shortlisted", "rejected", "interview_scheduled"

    @Column(name = "match_analysis", columnDefinition = "TEXT")
    private String matchAnalysis = "{}";

    @Column(name = "recruiter_feedback", columnDefinition = "TEXT")
    private String recruiterFeedback;

    @Column(name = "applied_at", nullable = false)
    private LocalDateTime appliedAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public Application() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getJobId() { return jobId; }
    public void setJobId(UUID jobId) { this.jobId = jobId; }
    public UUID getStudentId() { return studentId; }
    public void setStudentId(UUID studentId) { this.studentId = studentId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getMatchAnalysis() { return matchAnalysis; }
    public void setMatchAnalysis(String matchAnalysis) { this.matchAnalysis = matchAnalysis; }
    public String getRecruiterFeedback() { return recruiterFeedback; }
    public void setRecruiterFeedback(String recruiterFeedback) { this.recruiterFeedback = recruiterFeedback; }
    public LocalDateTime getAppliedAt() { return appliedAt; }
    public void setAppliedAt(LocalDateTime appliedAt) { this.appliedAt = appliedAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
