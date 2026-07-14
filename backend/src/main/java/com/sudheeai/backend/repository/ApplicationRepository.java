package com.sudheeai.backend.repository;

import com.sudheeai.backend.model.Application;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApplicationRepository extends JpaRepository<Application, UUID> {
    List<Application> findByStudentId(UUID studentId);
    List<Application> findByJobId(UUID jobId);
    Optional<Application> findByJobIdAndStudentId(UUID jobId, UUID studentId);
}
