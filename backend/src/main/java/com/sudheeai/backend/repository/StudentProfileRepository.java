package com.sudheeai.backend.repository;

import com.sudheeai.backend.model.StudentProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface StudentProfileRepository extends JpaRepository<StudentProfile, UUID> {
    Optional<StudentProfile> findByStudentId(UUID studentId);
}
