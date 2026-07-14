package com.sudheeai.backend.repository;

import com.sudheeai.backend.model.Interview;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface InterviewRepository extends JpaRepository<Interview, UUID> {
    List<Interview> findByStudentId(UUID studentId);
    List<Interview> findByRecruiterId(UUID recruiterId);
}
