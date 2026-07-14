package com.sudheeai.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sudheeai.backend.model.*;
import com.sudheeai.backend.repository.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/db")
@SuppressWarnings("unchecked")
public class DbQueryController {

    private final StudentRepository studentRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final RecruiterRepository recruiterRepository;
    private final JobRepository jobRepository;
    private final ApplicationRepository applicationRepository;
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final InterviewRepository interviewRepository;
    private final ObjectMapper mapper;

    public DbQueryController(
            StudentRepository studentRepository,
            StudentProfileRepository studentProfileRepository,
            RecruiterRepository recruiterRepository,
            JobRepository jobRepository,
            ApplicationRepository applicationRepository,
            NotificationRepository notificationRepository,
            UserRepository userRepository,
            InterviewRepository interviewRepository,
            ObjectMapper mapper) {
        this.studentRepository = studentRepository;
        this.studentProfileRepository = studentProfileRepository;
        this.recruiterRepository = recruiterRepository;
        this.jobRepository = jobRepository;
        this.applicationRepository = applicationRepository;
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.interviewRepository = interviewRepository;
        this.mapper = mapper;
    }

    @PostMapping("/{table}/select")
    public ResponseEntity<?> select(@PathVariable("table") String table, @RequestBody Map<String, Object> body) {
        // Normalize table name aliases
        String normalizedTable = table;
        if ("student_applications".equals(table)) normalizedTable = "applications";

        List<Map<String, Object>> filters = (List<Map<String, Object>>) body.get("filters");
        
        String eqCol = null;
        Object eqVal = null;
        String inCol = null;
        List<Object> inVals = null;
        
        if (filters != null) {
            for (Map<String, Object> filter : filters) {
                String type = (String) filter.get("type");
                String column = (String) filter.get("column");
                if ("eq".equals(type)) {
                    eqCol = column;
                    eqVal = filter.get("value");
                } else if ("in".equals(type)) {
                    inCol = column;
                    inVals = (List<Object>) filter.get("values");
                }
                // gte, lte, gt, lt, like, ilike, is, or — gracefully ignored for H2
            }
        }

        boolean single = (boolean) body.getOrDefault("single", false) || (boolean) body.getOrDefault("maybeSingle", false);

        if ("students".equals(normalizedTable)) {
            List<Student> list = new ArrayList<>();
            if ("user_id".equals(eqCol)) {
                studentRepository.findByUserId(UUID.fromString((String) eqVal)).ifPresent(list::add);
            } else if ("id".equals(eqCol)) {
                studentRepository.findById(UUID.fromString((String) eqVal)).ifPresent(list::add);
            } else if (inCol != null) {
                for (Object v : inVals) {
                    studentRepository.findById(UUID.fromString((String) v)).ifPresent(list::add);
                }
            } else {
                list.addAll(studentRepository.findAll());
            }
            return ResponseEntity.ok(single ? (list.isEmpty() ? null : list.get(0)) : list);
        }

        if ("student_profiles".equals(normalizedTable)) {
            List<StudentProfile> list = new ArrayList<>();
            if ("student_id".equals(eqCol)) {
                studentProfileRepository.findByStudentId(UUID.fromString((String) eqVal)).ifPresent(list::add);
            } else if (inCol != null) {
                for (Object v : inVals) {
                    studentProfileRepository.findByStudentId(UUID.fromString((String) v)).ifPresent(list::add);
                }
            } else {
                list.addAll(studentProfileRepository.findAll());
            }
            return ResponseEntity.ok(single ? (list.isEmpty() ? null : list.get(0)) : list);
        }

        if ("recruiters".equals(normalizedTable)) {
            List<Recruiter> list = new ArrayList<>();
            if ("user_id".equals(eqCol)) {
                recruiterRepository.findByUserId(UUID.fromString((String) eqVal)).ifPresent(list::add);
            } else if ("id".equals(eqCol)) {
                recruiterRepository.findById(UUID.fromString((String) eqVal)).ifPresent(list::add);
            } else {
                list.addAll(recruiterRepository.findAll());
            }
            return ResponseEntity.ok(single ? (list.isEmpty() ? null : list.get(0)) : list);
        }

        if ("jobs".equals(normalizedTable)) {
            List<Job> list = new ArrayList<>();
            if ("recruiter_id".equals(eqCol)) {
                list.addAll(jobRepository.findByRecruiterId(UUID.fromString((String) eqVal)));
            } else if ("id".equals(eqCol)) {
                jobRepository.findById(UUID.fromString((String) eqVal)).ifPresent(list::add);
            } else {
                list.addAll(jobRepository.findByStatus("active"));
            }
            
            List<Map<String, Object>> resultList = new ArrayList<>();
            for (Job job : list) {
                Map<String, Object> map = mapper.convertValue(job, Map.class);
                recruiterRepository.findById(job.getRecruiterId()).ifPresent(r -> {
                    map.put("recruiters", mapper.convertValue(r, Map.class));
                });
                resultList.add(map);
            }
            return ResponseEntity.ok(single ? (resultList.isEmpty() ? null : resultList.get(0)) : resultList);
        }

        if ("applications".equals(normalizedTable)) {
            List<Application> list = new ArrayList<>();
            if ("student_id".equals(eqCol)) {
                list.addAll(applicationRepository.findByStudentId(UUID.fromString((String) eqVal)));
            } else if ("job_id".equals(eqCol)) {
                list.addAll(applicationRepository.findByJobId(UUID.fromString((String) eqVal)));
            } else if ("id".equals(eqCol)) {
                applicationRepository.findById(UUID.fromString((String) eqVal)).ifPresent(list::add);
            } else if (inCol != null) {
                if ("job_id".equals(inCol)) {
                    for (Object v : inVals) {
                        list.addAll(applicationRepository.findByJobId(UUID.fromString((String) v)));
                    }
                } else if ("id".equals(inCol)) {
                    for (Object v : inVals) {
                        applicationRepository.findById(UUID.fromString((String) v)).ifPresent(list::add);
                    }
                }
            } else {
                list.addAll(applicationRepository.findAll());
            }

            List<Map<String, Object>> resultList = new ArrayList<>();
            for (Application app : list) {
                Map<String, Object> map = mapper.convertValue(app, Map.class);
                studentRepository.findById(app.getStudentId()).ifPresent(s -> {
                    map.put("students", mapper.convertValue(s, Map.class));
                });
                jobRepository.findById(app.getJobId()).ifPresent(j -> {
                    Map<String, Object> jobMap = mapper.convertValue(j, Map.class);
                    recruiterRepository.findById(j.getRecruiterId()).ifPresent(r -> {
                        jobMap.put("recruiters", mapper.convertValue(r, Map.class));
                    });
                    map.put("jobs", jobMap);
                });
                resultList.add(map);
            }
            return ResponseEntity.ok(single ? (resultList.isEmpty() ? null : resultList.get(0)) : resultList);
        }

        if ("notifications".equals(normalizedTable)) {
            List<Notification> list = new ArrayList<>();
            if ("user_id".equals(eqCol)) {
                list.addAll(notificationRepository.findByUserIdOrderByCreatedAtDesc(UUID.fromString((String) eqVal)));
            } else {
                list.addAll(notificationRepository.findAll());
            }
            return ResponseEntity.ok(single ? (list.isEmpty() ? null : list.get(0)) : list);
        }

        if ("user_roles".equals(normalizedTable)) {
            List<Map<String, Object>> list = new ArrayList<>();
            if ("user_id".equals(eqCol)) {
                userRepository.findById(UUID.fromString((String) eqVal)).ifPresent(u -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("role", u.getRole());
                    map.put("user_id", u.getId().toString());
                    list.add(map);
                });
            }
            return ResponseEntity.ok(single ? (list.isEmpty() ? null : list.get(0)) : list);
        }

        if ("interviews".equals(normalizedTable)) {
            List<Interview> list = new ArrayList<>();
            if ("student_id".equals(eqCol)) {
                list.addAll(interviewRepository.findByStudentId(UUID.fromString((String) eqVal)));
            } else if ("recruiter_id".equals(eqCol)) {
                list.addAll(interviewRepository.findByRecruiterId(UUID.fromString((String) eqVal)));
            } else if ("id".equals(eqCol)) {
                interviewRepository.findById(UUID.fromString((String) eqVal)).ifPresent(list::add);
            } else {
                list.addAll(interviewRepository.findAll());
            }
            return ResponseEntity.ok(single ? (list.isEmpty() ? null : list.get(0)) : list);
        }

        // For unrecognized tables, return empty array gracefully
        return ResponseEntity.ok(single ? null : Collections.emptyList());
    }

    @PostMapping("/{table}/insert")
    public ResponseEntity<?> insert(@PathVariable("table") String table, @RequestBody Map<String, Object> body) {
        Object rowsObj = body.get("rows");
        Map<String, Object> row = null;
        if (rowsObj instanceof List) {
            List<Map<String, Object>> rowsList = (List<Map<String, Object>>) rowsObj;
            if (!rowsList.isEmpty()) row = rowsList.get(0);
        } else if (rowsObj instanceof Map) {
            row = (Map<String, Object>) rowsObj;
        }

        if (row == null) {
            return ResponseEntity.badRequest().body("No row data to insert");
        }

        if ("students".equals(table)) {
            Student s = mapper.convertValue(row, Student.class);
            s = studentRepository.save(s);
            return ResponseEntity.ok(s);
        }

        if ("student_profiles".equals(table)) {
            StudentProfile sp = mapper.convertValue(row, StudentProfile.class);
            sp = studentProfileRepository.save(sp);
            return ResponseEntity.ok(sp);
        }

        if ("recruiters".equals(table)) {
            Recruiter r = mapper.convertValue(row, Recruiter.class);
            r = recruiterRepository.save(r);
            return ResponseEntity.ok(r);
        }

        if ("jobs".equals(table)) {
            Job j = mapper.convertValue(row, Job.class);
            j = jobRepository.save(j);
            return ResponseEntity.ok(j);
        }

        if ("applications".equals(table)) {
            Application app = mapper.convertValue(row, Application.class);
            app = applicationRepository.save(app);
            
            Optional<Job> jOpt = jobRepository.findById(app.getJobId());
            jOpt.ifPresent(job -> {
                job.setApplicationsCount(job.getApplicationsCount() + 1);
                jobRepository.save(job);
            });

            return ResponseEntity.ok(app);
        }

        if ("notifications".equals(table)) {
            Notification n = mapper.convertValue(row, Notification.class);
            n = notificationRepository.save(n);
            return ResponseEntity.ok(n);
        }

        if ("interviews".equals(table)) {
            Interview iv = mapper.convertValue(row, Interview.class);
            iv = interviewRepository.save(iv);
            return ResponseEntity.ok(iv);
        }

        return ResponseEntity.badRequest().body("Table not found: " + table);
    }

    @PostMapping("/{table}/update")
    public ResponseEntity<?> update(@PathVariable("table") String table, @RequestBody Map<String, Object> body) {
        Map<String, Object> values = (Map<String, Object>) body.get("values");
        List<Map<String, Object>> filters = (List<Map<String, Object>>) body.get("filters");

        String eqCol = null;
        Object eqVal = null;
        String inCol = null;
        List<Object> inVals = null;

        if (filters != null) {
            for (Map<String, Object> filter : filters) {
                String type = (String) filter.get("type");
                String column = (String) filter.get("column");
                if ("eq".equals(type)) {
                    eqCol = column;
                    eqVal = filter.get("value");
                } else if ("in".equals(type)) {
                    inCol = column;
                    inVals = (List<Object>) filter.get("values");
                }
            }
        }

        if ("students".equals(table)) {
            Optional<Student> opt = Optional.empty();
            if ("id".equals(eqCol)) {
                opt = studentRepository.findById(UUID.fromString((String) eqVal));
            }
            if (opt.isPresent()) {
                Student s = opt.get();
                if (values.containsKey("resume_url")) s.setResumeUrl((String) values.get("resume_url"));
                if (values.containsKey("profile_complete")) s.setProfileComplete((Boolean) values.get("profile_complete"));
                s.setUpdatedAt(LocalDateTime.now());
                studentRepository.save(s);
                return ResponseEntity.ok(s);
            }
        }

        if ("student_profiles".equals(table)) {
            Optional<StudentProfile> opt = Optional.empty();
            if ("student_id".equals(eqCol)) {
                opt = studentProfileRepository.findByStudentId(UUID.fromString((String) eqVal));
            }
            if (opt.isPresent()) {
                StudentProfile sp = opt.get();
                if (values.containsKey("github_url")) sp.setGithubUrl((String) values.get("github_url"));
                if (values.containsKey("leetcode_url")) sp.setLeetcodeUrl((String) values.get("leetcode_url"));
                if (values.containsKey("linkedin_url")) sp.setLinkedinUrl((String) values.get("linkedin_url"));
                sp.setUpdatedAt(LocalDateTime.now());
                studentProfileRepository.save(sp);
                return ResponseEntity.ok(sp);
            }
        }

        if ("applications".equals(table)) {
            Optional<Application> opt = Optional.empty();
            if ("id".equals(eqCol)) {
                opt = applicationRepository.findById(UUID.fromString((String) eqVal));
            }
            if (opt.isPresent()) {
                Application app = opt.get();
                if (values.containsKey("status")) app.setStatus((String) values.get("status"));
                if (values.containsKey("recruiter_feedback")) app.setRecruiterFeedback((String) values.get("recruiter_feedback"));
                app.setUpdatedAt(LocalDateTime.now());
                applicationRepository.save(app);
                return ResponseEntity.ok(app);
            }
        }

        if ("notifications".equals(table)) {
            List<Notification> list = new ArrayList<>();
            if ("id".equals(eqCol)) {
                notificationRepository.findById(UUID.fromString((String) eqVal)).ifPresent(list::add);
            } else if (inCol != null && "id".equals(inCol)) {
                for (Object v : inVals) {
                    notificationRepository.findById(UUID.fromString((String) v)).ifPresent(list::add);
                }
            }
            for (Notification n : list) {
                if (values.containsKey("is_read")) n.setIsRead((Boolean) values.get("is_read"));
                notificationRepository.save(n);
            }
            return ResponseEntity.ok(list);
        }

        if ("interviews".equals(table)) {
            Optional<Interview> opt = Optional.empty();
            if ("id".equals(eqCol)) {
                opt = interviewRepository.findById(UUID.fromString((String) eqVal));
            }
            if (opt.isPresent()) {
                Interview iv = opt.get();
                if (values.containsKey("status")) iv.setStatus((String) values.get("status"));
                if (values.containsKey("notes")) iv.setNotes((String) values.get("notes"));
                if (values.containsKey("meeting_link")) iv.setMeetingLink((String) values.get("meeting_link"));
                iv.setUpdatedAt(LocalDateTime.now());
                interviewRepository.save(iv);
                return ResponseEntity.ok(iv);
            }
        }

        return ResponseEntity.badRequest().body("Update failed for table: " + table);
    }
}
