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
    public ResponseEntity<?> select(
            @PathVariable("table") String table,
            @RequestBody Map<String, Object> body,
            @RequestAttribute(value = "userId", required = false) UUID callerUserId,
            @RequestAttribute(value = "userRole", required = false) String callerRole) {
        if (callerUserId == null || callerRole == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        boolean isAdmin = "admin".equalsIgnoreCase(callerRole);
        // Resolve caller identities once (null if not that role)
        UUID callerStudentId = studentRepository.findByUserId(callerUserId).map(Student::getId).orElse(null);
        UUID callerRecruiterId = recruiterRepository.findByUserId(callerUserId).map(Recruiter::getId).orElse(null);
        // Normalize table name aliases
        String normalizedTable = table;
        if ("student_applications".equals(table)) normalizedTable = "applications";

        List<Map<String, Object>> filters = (List<Map<String, Object>>) body.get("filters");

        String eqCol = null;
        Object eqVal = null;
        String inCol = null;
        List<Object> inVals = null;
        List<Map<String, Object>> extraFilters = new ArrayList<>();

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
                } else if ("gte".equals(type) || "lte".equals(type) || "gt".equals(type) || "lt".equals(type)
                        || "neq".equals(type) || "like".equals(type) || "ilike".equals(type) || "is".equals(type)) {
                    // Applied in-memory after the base query (PostgREST parity for local mode)
                    extraFilters.add(filter);
                } else if (type != null) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Unsupported filter type: " + type + ". Supported: eq, in, gte, lte, gt, lt, neq, like, ilike, is"));
                }
            }
        }

        try {

        boolean single = toBoolean(body.get("single")) || toBoolean(body.get("maybeSingle"));

        if ("students".equals(normalizedTable)) {
            // Students: own row only. Recruiters: single-row lookup only (talent view).
            // Bulk list restricted to admin to prevent enumeration.
            if (!isAdmin) {
                if ("student".equalsIgnoreCase(callerRole)) {
                    // Force scope to own record regardless of requested filter
                    if (callerStudentId == null) return ResponseEntity.ok(single ? null : Collections.emptyList());
                    if (eqVal != null && ("user_id".equals(eqCol) || "id".equals(eqCol))) {
                        UUID requested = safeParseUUID(eqVal);
                        if (requested == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid UUID filter"));
                        boolean owns = "user_id".equals(eqCol)
                                ? requested.equals(callerUserId)
                                : requested.equals(callerStudentId);
                        if (!owns) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    } else if (inCol == null) {
                        // No filter: return only own record instead of all students
                        List<Student> own = new ArrayList<>();
                        studentRepository.findByUserId(callerUserId).ifPresent(own::add);
                        return ResponseEntity.ok(single ? (own.isEmpty() ? null : own.get(0)) : own);
                    } else {
                        return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    }
                } else if ("recruiter".equalsIgnoreCase(callerRole)) {
                    // Recruiters may look up specific students or browse talent pool.
                    // Bulk list allowed (needed for talent discovery); detailed RLS
                    // (only applicants) enforced at Supabase layer in cloud mode.
                    if (eqVal == null && inCol == null) {
                        // Allow list but cap to avoid full dump via mock API
                        List<Student> all = studentRepository.findAll();
                        if (all.size() > 200) all = all.subList(0, 200);
                        return ResponseEntity.ok(single ? null : all);
                    }
                } else {
                    return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                }
            }
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
            if (!isAdmin) {
                if ("student".equalsIgnoreCase(callerRole)) {
                    if (callerStudentId == null) return ResponseEntity.ok(single ? null : Collections.emptyList());
                    if ("student_id".equals(eqCol) && eqVal != null) {
                        UUID requested = safeParseUUID(eqVal);
                        if (requested == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid UUID filter"));
                        if (!requested.equals(callerStudentId)) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    } else if (inCol == null) {
                        List<StudentProfile> own = new ArrayList<>();
                        studentProfileRepository.findByStudentId(callerStudentId).ifPresent(own::add);
                        return ResponseEntity.ok(single ? (own.isEmpty() ? null : own.get(0)) : own);
                    } else {
                        return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    }
                } else if (!"recruiter".equalsIgnoreCase(callerRole)) {
                    return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                }
                // recruiters: single lookups allowed; bulk list denied below via fallthrough guard
                if ("recruiter".equalsIgnoreCase(callerRole) && eqVal == null && inCol == null) {
                    return ResponseEntity.status(403).body(Map.of("error", "Bulk profile list forbidden"));
                }
            }
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
            if (!isAdmin) {
                if ("recruiter".equalsIgnoreCase(callerRole)) {
                    // Own row only, except single-by-id lookup allowed for job embeds
                    if ("id".equals(eqCol) && eqVal != null) {
                        // allowed: public recruiter card for a job
                    } else if ("user_id".equals(eqCol) && eqVal != null) {
                        UUID requested = safeParseUUID(eqVal);
                        if (requested == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid UUID filter"));
                        if (!requested.equals(callerUserId)) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    } else if (eqVal == null) {
                        List<Recruiter> own = new ArrayList<>();
                        recruiterRepository.findByUserId(callerUserId).ifPresent(own::add);
                        return ResponseEntity.ok(single ? (own.isEmpty() ? null : own.get(0)) : own);
                    } else {
                        return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    }
                } else if ("student".equalsIgnoreCase(callerRole)) {
                    // Students may fetch a single recruiter for a job display, never list all
                    if (!(eqVal != null && "id".equals(eqCol))) {
                        return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    }
                } else {
                    return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                }
            }
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
            if (!isAdmin) {
                if ("student".equalsIgnoreCase(callerRole)) {
                    if (callerStudentId == null) return ResponseEntity.ok(single ? null : Collections.emptyList());
                    // Students may only query their own applications
                    if ("student_id".equals(eqCol) && eqVal != null) {
                        UUID requested = safeParseUUID(eqVal);
                        if (requested == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid UUID filter"));
                        if (!requested.equals(callerStudentId)) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    } else if ("id".equals(eqCol) && eqVal != null) {
                        UUID appId = safeParseUUID(eqVal);
                        if (appId == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid UUID filter"));
                        boolean owns = applicationRepository.findById(appId)
                                .map(a -> a.getStudentId().equals(callerStudentId)).orElse(true);
                        if (!owns) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    } else if (inCol == null && eqVal == null) {
                        List<Application> own = applicationRepository.findByStudentId(callerStudentId);
                        return ResponseEntity.ok(single ? null : enrichApplications(own));
                    } else if ("job_id".equals(eqCol)) {
                        return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    }
                } else if ("recruiter".equalsIgnoreCase(callerRole)) {
                    if (callerRecruiterId == null) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    // Recruiters may only query applications for their own jobs
                    if ("job_id".equals(eqCol) && eqVal != null) {
                        UUID jobId = safeParseUUID(eqVal);
                        if (jobId == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid UUID filter"));
                        if (!ownsJob(jobId, callerRecruiterId)) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    } else if ("id".equals(eqCol) && eqVal != null) {
                        UUID appId = safeParseUUID(eqVal);
                        if (appId == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid UUID filter"));
                        boolean owns = applicationRepository.findById(appId)
                                .map(a -> ownsJob(a.getJobId(), callerRecruiterId)).orElse(true);
                        if (!owns) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    } else if (inCol == null && eqVal == null) {
                        // No filter: return applications across own jobs only
                        List<Job> ownJobs = jobRepository.findByRecruiterId(callerRecruiterId);
                        List<Application> own = new ArrayList<>();
                        for (Job j : ownJobs) own.addAll(applicationRepository.findByJobId(j.getId()));
                        return ResponseEntity.ok(single ? null : enrichApplications(own));
                    } else if ("student_id".equals(eqCol)) {
                        return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    }
                } else {
                    return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                }
            }
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
            // Owner-only: user_id filter must equal caller
            if (!isAdmin) {
                if (eqVal != null && "user_id".equals(eqCol)) {
                    UUID requested = safeParseUUID(eqVal);
                    if (requested == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid UUID filter"));
                    if (!requested.equals(callerUserId)) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                } else if (eqVal == null) {
                    List<Notification> own = notificationRepository.findByUserIdOrderByCreatedAtDesc(callerUserId);
                    return ResponseEntity.ok(single ? (own.isEmpty() ? null : own.get(0)) : own);
                } else {
                    return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                }
            }
            List<Notification> list = new ArrayList<>();
            if ("user_id".equals(eqCol)) {
                list.addAll(notificationRepository.findByUserIdOrderByCreatedAtDesc(UUID.fromString((String) eqVal)));
            } else {
                list.addAll(notificationRepository.findAll());
            }
            return ResponseEntity.ok(single ? (list.isEmpty() ? null : list.get(0)) : list);
        }

        if ("user_roles".equals(normalizedTable)) {
            // Owner or admin only
            if (!isAdmin) {
                if (eqVal == null || !"user_id".equals(eqCol)) {
                    return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                }
                UUID requested = safeParseUUID(eqVal);
                if (requested == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid UUID filter"));
                if (!requested.equals(callerUserId)) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }
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
            if (!isAdmin) {
                if ("student".equalsIgnoreCase(callerRole)) {
                    if (callerStudentId == null) return ResponseEntity.ok(single ? null : Collections.emptyList());
                    if ("student_id".equals(eqCol) && eqVal != null) {
                        UUID requested = safeParseUUID(eqVal);
                        if (requested == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid UUID filter"));
                        if (!requested.equals(callerStudentId)) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    } else if (eqVal == null) {
                        return ResponseEntity.ok(single ? null : interviewRepository.findByStudentId(callerStudentId));
                    } else if (!"id".equals(eqCol)) {
                        return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    }
                } else if ("recruiter".equalsIgnoreCase(callerRole)) {
                    if (callerRecruiterId == null) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    if ("recruiter_id".equals(eqCol) && eqVal != null) {
                        UUID requested = safeParseUUID(eqVal);
                        if (requested == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid UUID filter"));
                        if (!requested.equals(callerRecruiterId)) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    } else if (eqVal == null) {
                        return ResponseEntity.ok(single ? null : interviewRepository.findByRecruiterId(callerRecruiterId));
                    } else if (!"id".equals(eqCol)) {
                        return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    }
                } else {
                    return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                }
            }
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
            if (!extraFilters.isEmpty()) {
                List<Interview> filtered = new ArrayList<>();
                for (Interview iv : list) {
                    Map<String, Object> row = mapper.convertValue(iv, Map.class);
                    if (passesExtraFilters(row, extraFilters)) filtered.add(iv);
                }
                list = filtered;
            }
            return ResponseEntity.ok(single ? (list.isEmpty() ? null : list.get(0)) : list);
        }

        // For unrecognized tables, return empty array gracefully
        return ResponseEntity.ok(single ? null : Collections.emptyList());
        } catch (IllegalArgumentException | ClassCastException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid filter value"));
        }
    }

    @PostMapping("/{table}/insert")
    public ResponseEntity<?> insert(
            @PathVariable("table") String table,
            @RequestBody Map<String, Object> body,
            @RequestAttribute(value = "userId", required = false) UUID callerUserId,
            @RequestAttribute(value = "userRole", required = false) String callerRole) {
        if (callerUserId == null || callerRole == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        boolean isAdmin = "admin".equalsIgnoreCase(callerRole);
        UUID callerStudentId = studentRepository.findByUserId(callerUserId).map(Student::getId).orElse(null);
        UUID callerRecruiterId = recruiterRepository.findByUserId(callerUserId).map(Recruiter::getId).orElse(null);
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
            if (!isAdmin) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            Student s = mapper.convertValue(row, Student.class);
            s = studentRepository.save(s);
            return ResponseEntity.ok(s);
        }

        if ("student_profiles".equals(table)) {
            if (!isAdmin) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            StudentProfile sp = mapper.convertValue(row, StudentProfile.class);
            sp = studentProfileRepository.save(sp);
            return ResponseEntity.ok(sp);
        }

        if ("recruiters".equals(table)) {
            if (!isAdmin) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            Recruiter r = mapper.convertValue(row, Recruiter.class);
            r = recruiterRepository.save(r);
            return ResponseEntity.ok(r);
        }

        if ("jobs".equals(table)) {
            try {
                Job j = mapper.convertValue(row, Job.class);
                if (!isAdmin) {
                    if (!"recruiter".equalsIgnoreCase(callerRole) || callerRecruiterId == null
                            || j.getRecruiterId() == null || !j.getRecruiterId().equals(callerRecruiterId)) {
                        return ResponseEntity.status(403).body(Map.of("error", "Can only create jobs for yourself"));
                    }
                }
                j = jobRepository.save(j);
                return ResponseEntity.ok(j);
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid job payload"));
            }
        }

        if ("applications".equals(table)) {
            try {
                Application app = mapper.convertValue(row, Application.class);
                if (!isAdmin) {
                    if (!"student".equalsIgnoreCase(callerRole) || callerStudentId == null
                            || app.getStudentId() == null || !app.getStudentId().equals(callerStudentId)) {
                        return ResponseEntity.status(403).body(Map.of("error", "Can only apply as yourself"));
                    }
                }
                if (app.getJobId() == null || app.getStudentId() == null) {
                    return ResponseEntity.badRequest().body(Map.of("error", "job_id and student_id required"));
                }
                if (applicationRepository.findByJobIdAndStudentId(app.getJobId(), app.getStudentId()).isPresent()) {
                    return ResponseEntity.status(409).body(Map.of("error", "Already applied", "code", "23505"));
                }
                app = applicationRepository.save(app);
                
                Optional<Job> jOpt = jobRepository.findById(app.getJobId());
            jOpt.ifPresent(job -> {
                job.setApplicationsCount(job.getApplicationsCount() + 1);
                jobRepository.save(job);
            });

            return ResponseEntity.ok(app);
        }

        if ("notifications".equals(table)) {
            if (!isAdmin) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            Notification n = mapper.convertValue(row, Notification.class);
            n = notificationRepository.save(n);
            return ResponseEntity.ok(n);
        }

        if ("interviews".equals(table)) {
            try {
                Interview iv = mapper.convertValue(row, Interview.class);
                if (!isAdmin) {
                    if (!"recruiter".equalsIgnoreCase(callerRole) || callerRecruiterId == null
                            || iv.getRecruiterId() == null || !iv.getRecruiterId().equals(callerRecruiterId)) {
                        return ResponseEntity.status(403).body(Map.of("error", "Only owning recruiter can schedule"));
                    }
                    if (iv.getJobId() != null && !ownsJob(iv.getJobId(), callerRecruiterId)) {
                        return ResponseEntity.status(403).body(Map.of("error", "Job does not belong to you"));
                    }
                }
                iv = interviewRepository.save(iv);
                return ResponseEntity.ok(iv);
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid interview payload"));
            }
        }

        return ResponseEntity.badRequest().body("Table not found: " + table);
    }

    @PostMapping("/{table}/update")
    public ResponseEntity<?> update(
            @PathVariable("table") String table,
            @RequestBody Map<String, Object> body,
            @RequestAttribute(value = "userId", required = false) UUID callerUserId,
            @RequestAttribute(value = "userRole", required = false) String callerRole) {
        if (callerUserId == null || callerRole == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        boolean isAdmin = "admin".equalsIgnoreCase(callerRole);
        UUID callerStudentId = studentRepository.findByUserId(callerUserId).map(Student::getId).orElse(null);
        UUID callerRecruiterId = recruiterRepository.findByUserId(callerUserId).map(Recruiter::getId).orElse(null);
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
                UUID id = safeParseUUID(eqVal);
                if (id == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid UUID"));
                opt = studentRepository.findById(id);
            }
            if (opt.isPresent()) {
                Student s = opt.get();
                if (!isAdmin) {
                    if (callerStudentId == null || !s.getId().equals(callerStudentId)) {
                        return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    }
                }
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
                UUID id = safeParseUUID(eqVal);
                if (id == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid UUID"));
                opt = studentProfileRepository.findByStudentId(id);
            }
            if (opt.isPresent()) {
                StudentProfile sp = opt.get();
                if (!isAdmin) {
                    if (callerStudentId == null || !sp.getStudentId().equals(callerStudentId)) {
                        return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    }
                }
                if (values.containsKey("github_url")) sp.setGithubUrl((String) values.get("github_url"));
                if (values.containsKey("leetcode_url")) sp.setLeetcodeUrl((String) values.get("leetcode_url"));
                if (values.containsKey("linkedin_url")) sp.setLinkedinUrl((String) values.get("linkedin_url"));
                sp.setUpdatedAt(LocalDateTime.now());
                studentProfileRepository.save(sp);
                return ResponseEntity.ok(sp);
            }
        }

        if ("jobs".equals(table)) {
            Optional<Job> opt = Optional.empty();
            if ("id".equals(eqCol)) {
                UUID id = safeParseUUID(eqVal);
                if (id == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid UUID"));
                opt = jobRepository.findById(id);
            }
            if (opt.isPresent()) {
                Job j = opt.get();
                if (!isAdmin) {
                    if (callerRecruiterId == null || j.getRecruiterId() == null || !j.getRecruiterId().equals(callerRecruiterId)) {
                        return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    }
                }
                if (values.containsKey("status")) j.setStatus((String) values.get("status"));
                if (values.containsKey("description")) j.setDescription((String) values.get("description"));
                if (values.containsKey("salary_range")) j.setSalaryRange((String) values.get("salary_range"));
                if (values.containsKey("num_openings") && values.get("num_openings") instanceof Number) {
                    j.setNumOpenings(((Number) values.get("num_openings")).intValue());
                }
                j.setUpdatedAt(LocalDateTime.now());
                jobRepository.save(j);
                return ResponseEntity.ok(j);
            }
        }

        if ("applications".equals(table)) {
            Optional<Application> opt = Optional.empty();
            if ("id".equals(eqCol)) {
                UUID id = safeParseUUID(eqVal);
                if (id == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid UUID"));
                opt = applicationRepository.findById(id);
            }
            if (opt.isPresent()) {
                Application app = opt.get();
                if (!isAdmin) {
                    // Students cannot change status/feedback; recruiters only for own jobs
                    if ("student".equalsIgnoreCase(callerRole)) {
                        return ResponseEntity.status(403).body(Map.of("error", "Students cannot update applications"));
                    }
                    if ("recruiter".equalsIgnoreCase(callerRole)) {
                        if (callerRecruiterId == null || !ownsJob(app.getJobId(), callerRecruiterId)) {
                            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                        }
                    } else {
                        return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    }
                }
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
                UUID id = safeParseUUID(eqVal);
                if (id == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid UUID"));
                notificationRepository.findById(id).ifPresent(list::add);
            } else if (inCol != null && "id".equals(inCol)) {
                for (Object v : inVals) {
                    UUID id = safeParseUUID(v);
                    if (id == null) continue;
                    notificationRepository.findById(id).ifPresent(list::add);
                }
            }
            if (!isAdmin) {
                for (Notification n : list) {
                    if (n.getUserId() == null || !n.getUserId().equals(callerUserId)) {
                        return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    }
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
                UUID id = safeParseUUID(eqVal);
                if (id == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid UUID"));
                opt = interviewRepository.findById(id);
            }
            if (opt.isPresent()) {
                Interview iv = opt.get();
                if (!isAdmin) {
                    boolean isOwnerStudent = callerStudentId != null && callerStudentId.equals(iv.getStudentId());
                    boolean isOwnerRecruiter = callerRecruiterId != null && callerRecruiterId.equals(iv.getRecruiterId());
                    if (!isOwnerStudent && !isOwnerRecruiter) {
                        return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    }
                }
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

    @PostMapping("/{table}/delete")
    public ResponseEntity<?> delete(
            @PathVariable("table") String table,
            @RequestBody Map<String, Object> body,
            @RequestAttribute(value = "userId", required = false) UUID callerUserId,
            @RequestAttribute(value = "userRole", required = false) String callerRole) {
        if (callerUserId == null || callerRole == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        boolean isAdmin = "admin".equalsIgnoreCase(callerRole);
        UUID callerRecruiterId = recruiterRepository.findByUserId(callerUserId).map(Recruiter::getId).orElse(null);
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
        if (eqCol == null && inCol == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Delete requires an eq or in filter"));
        }
        List<UUID> ids = new ArrayList<>();
        if (eqVal != null && "id".equals(eqCol)) {
            UUID id = safeParseUUID(eqVal);
            if (id == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid UUID"));
            ids.add(id);
        } else if (inVals != null && "id".equals(inCol)) {
            for (Object v : inVals) {
                UUID id = safeParseUUID(v);
                if (id != null) ids.add(id);
            }
        } else {
            return ResponseEntity.badRequest().body(Map.of("error", "Delete only supports id eq/in filters"));
        }
        if (ids.isEmpty()) return ResponseEntity.ok(Collections.emptyList());
        try {
            if ("notifications".equals(table)) {
                List<Notification> doomed = new ArrayList<>();
                for (UUID id : ids) notificationRepository.findById(id).ifPresent(doomed::add);
                if (!isAdmin) {
                    for (Notification n : doomed) {
                        if (n.getUserId() == null || !n.getUserId().equals(callerUserId)) {
                            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                        }
                    }
                }
                for (Notification n : doomed) notificationRepository.deleteById(n.getId());
                return ResponseEntity.ok(doomed);
            }
            if ("interviews".equals(table)) {
                List<Interview> doomed = new ArrayList<>();
                for (UUID id : ids) interviewRepository.findById(id).ifPresent(doomed::add);
                if (!isAdmin) {
                    for (Interview iv : doomed) {
                        boolean ownerRecruiter = callerRecruiterId != null && callerRecruiterId.equals(iv.getRecruiterId());
                        if (!ownerRecruiter) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    }
                }
                for (Interview iv : doomed) interviewRepository.deleteById(iv.getId());
                return ResponseEntity.ok(doomed);
            }
            if ("jobs".equals(table)) {
                List<Job> doomed = new ArrayList<>();
                for (UUID id : ids) jobRepository.findById(id).ifPresent(doomed::add);
                if (!isAdmin) {
                    for (Job j : doomed) {
                        if (callerRecruiterId == null || !callerRecruiterId.equals(j.getRecruiterId())) {
                            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                        }
                    }
                }
                for (Job j : doomed) jobRepository.deleteById(j.getId());
                return ResponseEntity.ok(doomed);
            }
            if ("applications".equals(table)) {
                if (!isAdmin) return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                List<Application> doomed = new ArrayList<>();
                for (UUID id : ids) applicationRepository.findById(id).ifPresent(doomed::add);
                for (Application a : doomed) applicationRepository.deleteById(a.getId());
                return ResponseEntity.ok(doomed);
            }
            return ResponseEntity.badRequest().body(Map.of("error", "Delete not supported for table: " + table));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Delete failed"));
        }
    }

    private boolean passesExtraFilters(Map<String, Object> row, List<Map<String, Object>> extraFilters) {
        for (Map<String, Object> filter : extraFilters) {
            String type = (String) filter.get("type");
            String column = (String) filter.get("column");
            Object expected = filter.get("value");
            Object actual = row.get(column);
            int cmp = compareFilterValues(actual, expected);
            if ("gte".equals(type) && cmp < 0) return false;
            if ("lte".equals(type) && cmp > 0) return false;
            if ("gt".equals(type) && cmp <= 0) return false;
            if ("lt".equals(type) && cmp >= 0) return false;
            if ("neq".equals(type) && cmp == 0) return false;
            if ("like".equals(type)) {
                if (actual == null || expected == null) return false;
                String pattern = String.valueOf(expected).replace("%", "");
                if (!String.valueOf(actual).contains(pattern)) return false;
            }
            if ("ilike".equals(type)) {
                if (actual == null || expected == null) return false;
                String pattern = String.valueOf(expected).replace("%", "").toLowerCase();
                if (!String.valueOf(actual).toLowerCase().contains(pattern)) return false;
            }
            if ("is".equals(type)) {
                if (expected == null && actual != null) return false;
                if (expected != null && !String.valueOf(expected).equalsIgnoreCase(String.valueOf(actual))) return false;
            }
        }
        return true;
    }

    private int compareFilterValues(Object actual, Object expected) {
        if (actual == null && expected == null) return 0;
        if (actual == null) return -1;
        if (expected == null) return 1;
        if (actual instanceof Number && expected instanceof Number) {
            return Double.compare(((Number) actual).doubleValue(), ((Number) expected).doubleValue());
        }
        try {
            double a = Double.parseDouble(String.valueOf(actual));
            double b = Double.parseDouble(String.valueOf(expected));
            return Double.compare(a, b);
        } catch (NumberFormatException ignored) {
        }
        return String.valueOf(actual).compareTo(String.valueOf(expected));
    }

    private UUID safeParseUUID(Object val) {
        if (val == null) return null;
        try {
            return UUID.fromString(String.valueOf(val).trim());
        } catch (Exception e) {
            return null;
        }
    }

    private boolean toBoolean(Object val) {
        if (val instanceof Boolean) return (Boolean) val;
        if (val instanceof String) return Boolean.parseBoolean(((String) val).trim());
        return false;
    }

    private boolean ownsJob(UUID jobId, UUID recruiterId) {
        if (jobId == null || recruiterId == null) return false;
        return jobRepository.findById(jobId)
                .map(j -> recruiterId.equals(j.getRecruiterId()))
                .orElse(false);
    }

    private List<Map<String, Object>> enrichApplications(List<Application> apps) {
        List<Map<String, Object>> resultList = new ArrayList<>();
        for (Application app : apps) {
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
        return resultList;
    }
}
