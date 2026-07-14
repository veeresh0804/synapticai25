package com.sudheeai.backend.repository;

import com.sudheeai.backend.model.Recruiter;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface RecruiterRepository extends JpaRepository<Recruiter, UUID> {
    Optional<Recruiter> findByUserId(UUID userId);
    Optional<Recruiter> findByEmail(String email);
}
