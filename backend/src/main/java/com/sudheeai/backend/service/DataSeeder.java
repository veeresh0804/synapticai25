package com.sudheeai.backend.service;

import com.sudheeai.backend.model.*;
import com.sudheeai.backend.repository.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class DataSeeder {

    private final UserRepository userRepository;
    private final StudentRepository studentRepository;
    private final RecruiterRepository recruiterRepository;
    private final JobRepository jobRepository;
    private final ApplicationRepository applicationRepository;
    private final NotificationRepository notificationRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final PasswordEncoder passwordEncoder;

    private final Random rng = new Random(42);

    public DataSeeder(
            UserRepository userRepository,
            StudentRepository studentRepository,
            RecruiterRepository recruiterRepository,
            JobRepository jobRepository,
            ApplicationRepository applicationRepository,
            NotificationRepository notificationRepository,
            StudentProfileRepository studentProfileRepository,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.studentRepository = studentRepository;
        this.recruiterRepository = recruiterRepository;
        this.jobRepository = jobRepository;
        this.applicationRepository = applicationRepository;
        this.notificationRepository = notificationRepository;
        this.studentProfileRepository = studentProfileRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // ───────── NAME POOLS ─────────
    private static final String[] FIRST_NAMES_MALE = {
        "Aarav", "Vihaan", "Aditya", "Sai", "Arjun", "Reyansh", "Ayaan", "Krishna",
        "Ishaan", "Shaurya", "Atharv", "Dhruv", "Kabir", "Ritvik", "Aarush",
        "Kian", "Darsh", "Vivaan", "Abhinav", "Ansh", "Harsh", "Rohan", "Pranav",
        "Yash", "Dev", "Neil", "Arnav", "Tanmay", "Manish", "Ravi", "Suresh",
        "Vikram", "Raj", "Sameer", "Nikhil", "Kunal", "Varun", "Siddharth",
        "Karthik", "Rahul", "Amit", "Gaurav", "Akash", "Deepak", "Mohit",
        "Tarun", "Naveen", "Pavan", "Venkat", "Sunil", "Manoj", "Ajay",
        "Sachin", "Rakesh", "Pradeep", "Sandeep", "Ankit", "Tushar", "Aman",
        "Vishal", "Ashish", "Sourabh", "Himanshu", "Shubham", "Rishabh"
    };

    private static final String[] FIRST_NAMES_FEMALE = {
        "Aadhya", "Ananya", "Diya", "Myra", "Sara", "Anika", "Isha", "Kavya",
        "Navya", "Tara", "Aditi", "Priya", "Shruti", "Meera", "Riya",
        "Pooja", "Sneha", "Neha", "Anjali", "Nisha", "Swati", "Divya",
        "Aishwarya", "Tanvi", "Sakshi", "Kriti", "Bhavna", "Gauri", "Rashmi",
        "Sonia", "Pallavi", "Mansi", "Deepika", "Komal", "Simran", "Surbhi",
        "Megha", "Jyoti", "Nupur", "Richa", "Garima", "Shikha", "Parul",
        "Aparna", "Lata", "Sunita", "Vandana", "Archana", "Chandni", "Bharti",
        "Diksha", "Ekta", "Falguni", "Hema", "Ira", "Juhi", "Kamini",
        "Lavanya", "Madhuri", "Namita", "Oviya", "Preeti", "Radhika", "Sanika"
    };

    private static final String[] LAST_NAMES = {
        "Kumar", "Sharma", "Patel", "Singh", "Gupta", "Verma", "Joshi", "Reddy",
        "Nair", "Iyer", "Chatterjee", "Banerjee", "Mukherjee", "Das", "Bose",
        "Sen", "Ghosh", "Roy", "Dutta", "Mishra", "Pandey", "Tripathi",
        "Shukla", "Tiwari", "Saxena", "Agarwal", "Jain", "Mehta", "Shah",
        "Desai", "Kulkarni", "Patil", "Rao", "Hegde", "Shetty", "Menon",
        "Pillai", "Bhat", "Kamath", "Deshpande", "Gokhale", "Thakur", "Chauhan",
        "Rathore", "Rajput", "Yadav", "Choudhary", "Malhotra", "Kapoor", "Khanna"
    };

    // ───────── INSTITUTION POOLS ─────────
    private static final String[] INSTITUTIONS = {
        "IIT Bombay", "IIT Delhi", "IIT Madras", "IIT Kanpur", "IIT Kharagpur",
        "IIT Roorkee", "IIT Guwahati", "IIT Hyderabad", "IIT BHU Varanasi",
        "IIT Indore", "IIT (ISM) Dhanbad", "IIT Tirupati", "IIT Palakkad",
        "IIT Dharwad", "IIT Bhilai", "IIT Goa", "IIT Jammu", "IIT Jodhpur",
        "NIT Trichy", "NIT Surathkal", "NIT Warangal", "NIT Calicut",
        "NIT Rourkela", "NIT Allahabad (MNNIT)", "NIT Kurukshetra",
        "NIT Jaipur (MNIT)", "NIT Nagpur (VNIT)", "NIT Bhopal (MANIT)",
        "NIT Durgapur", "NIT Silchar", "NIT Srinagar", "NIT Hamirpur",
        "IIIT Hyderabad", "IIIT Delhi", "IIIT Bangalore", "IIIT Allahabad",
        "BITS Pilani", "BITS Goa", "BITS Hyderabad",
        "VIT Vellore", "SRM Institute of Science and Technology",
        "Manipal Institute of Technology", "PESIT Bangalore",
        "Delhi Technological University (DTU)", "Netaji Subhas University of Technology (NSUT)",
        "Jadavpur University", "PSG College of Technology",
        "College of Engineering Pune (COEP)", "Thapar Institute of Engineering",
        "Anna University", "Amity University Noida",
        "Shiv Nadar University", "Ashoka University",
        "LNMIIT Jaipur", "DA-IICT Gandhinagar",
        "IIIT Sri City", "Indian Statistical Institute Kolkata"
    };

    private static final String[] DEGREES = {
        "B.Tech", "B.Tech", "B.Tech", "B.Tech",  // weighted towards B.Tech
        "M.Tech", "M.Tech",
        "B.E.", "B.E.",
        "M.S.", "MCA", "B.Sc (Hons)", "Dual Degree (B.Tech + M.Tech)"
    };

    private static final String[] BRANCHES = {
        "Computer Science and Engineering", "Computer Science and Engineering",
        "Computer Science and Engineering",  // weighted
        "Information Technology", "Information Technology",
        "Electronics and Communication Engineering",
        "Electrical Engineering", "Electrical and Electronics Engineering",
        "Mechanical Engineering", "Civil Engineering",
        "Data Science and Artificial Intelligence",
        "Mathematics and Computing", "Chemical Engineering",
        "Aerospace Engineering", "Biotechnology",
        "Instrumentation Engineering", "Production Engineering",
        "Metallurgical and Materials Engineering"
    };

    private static final String[] PHONE_PREFIXES = {
        "98", "97", "96", "95", "94", "93", "91", "90", "89", "88", "87", "86", "85", "84", "83", "82", "81", "80", "79", "78", "77", "76", "75", "74", "73", "72", "70"
    };

    // ───────── EMAIL DOMAIN MAPPING ─────────
    private String getEmailDomain(String institution) {
        if (institution.startsWith("IIT ")) return institution.replace("IIT ", "").toLowerCase().replaceAll("[() ]", "") + ".iitb.ac.in";
        if (institution.contains("IIT Bombay")) return "iitb.ac.in";
        if (institution.contains("IIT Delhi")) return "iitd.ac.in";
        if (institution.contains("IIT Madras")) return "smail.iitm.ac.in";
        if (institution.contains("IIT Kanpur")) return "iitk.ac.in";
        if (institution.contains("IIT Kharagpur")) return "iitkgp.ac.in";
        if (institution.contains("IIT Roorkee")) return "iitr.ac.in";
        if (institution.contains("IIT Guwahati")) return "iitg.ac.in";
        if (institution.contains("IIT Hyderabad")) return "iith.ac.in";
        if (institution.contains("IIT BHU")) return "itbhu.ac.in";
        if (institution.contains("NIT Trichy")) return "nitt.edu";
        if (institution.contains("NIT Surathkal")) return "nitk.edu.in";
        if (institution.contains("NIT Warangal")) return "nitw.ac.in";
        if (institution.contains("NIT Calicut")) return "nitc.ac.in";
        if (institution.contains("NIT Rourkela")) return "nitr.ac.in";
        if (institution.contains("IIIT Hyderabad")) return "iiit.ac.in";
        if (institution.contains("IIIT Delhi")) return "iiitd.ac.in";
        if (institution.contains("IIIT Bangalore")) return "iiitb.ac.in";
        if (institution.contains("BITS Pilani")) return "pilani.bits-pilani.ac.in";
        if (institution.contains("BITS Goa")) return "goa.bits-pilani.ac.in";
        if (institution.contains("BITS Hyderabad")) return "hyd.bits-pilani.ac.in";
        if (institution.contains("VIT")) return "vitstudent.ac.in";
        if (institution.contains("SRM")) return "srmist.edu.in";
        if (institution.contains("Manipal")) return "learner.manipal.edu";
        if (institution.contains("DTU")) return "dtu.ac.in";
        if (institution.contains("NSUT")) return "nsut.ac.in";
        if (institution.contains("Jadavpur")) return "jadavpuruniv.in";
        if (institution.contains("Anna")) return "annauniv.edu";
        if (institution.contains("Thapar")) return "thapar.edu";
        if (institution.contains("COEP")) return "coep.ac.in";
        return "student.university.ac.in";
    }

    // ───────── COMPANY DATA ─────────
    private static final String[][] COMPANIES = {
        {"Tata Consultancy Services", "https://www.tcs.com", "tcs.com"},
        {"Infosys", "https://www.infosys.com", "infosys.com"},
        {"Wipro", "https://www.wipro.com", "wipro.com"},
        {"HCL Technologies", "https://www.hcltech.com", "hcltech.com"},
        {"Tech Mahindra", "https://www.techmahindra.com", "techmahindra.com"},
        {"Google India", "https://careers.google.com", "google.com"},
        {"Microsoft India", "https://careers.microsoft.com", "microsoft.com"},
        {"Amazon India", "https://www.amazon.jobs", "amazon.com"},
        {"Flipkart", "https://www.flipkart.com", "flipkart.com"},
        {"Razorpay", "https://razorpay.com", "razorpay.com"},
        {"Zomato", "https://www.zomato.com", "zomato.com"},
        {"Swiggy", "https://www.swiggy.com", "swiggy.com"},
        {"CRED", "https://cred.club", "cred.club"},
        {"PhonePe", "https://www.phonepe.com", "phonepe.com"},
        {"Paytm", "https://paytm.com", "paytm.com"},
        {"Reliance Jio", "https://www.jio.com", "jio.com"},
        {"Myntra", "https://www.myntra.com", "myntra.com"},
        {"Ola Cabs", "https://www.olacabs.com", "olacabs.com"},
        {"Zoho Corporation", "https://www.zoho.com", "zoho.com"},
        {"Freshworks", "https://www.freshworks.com", "freshworks.com"},
        {"Byju's", "https://byjus.com", "byjus.com"},
        {"Meesho", "https://meesho.com", "meesho.com"},
        {"Dream11", "https://www.dream11.com", "dream11.com"},
        {"Zerodha", "https://zerodha.com", "zerodha.com"},
        {"Groww", "https://groww.in", "groww.in"}
    };

    private static final String[] RECRUITER_DESIGNATIONS = {
        "Talent Acquisition Lead", "Senior Technical Recruiter",
        "Campus Hiring Manager", "HR Business Partner",
        "Engineering Manager", "VP of Engineering",
        "Head of Talent Acquisition", "Technical Hiring Lead",
        "People Operations Manager", "University Relations Manager",
        "Recruitment Head", "Director of Engineering",
        "Chief People Officer", "Staffing Manager",
        "Technical Program Manager"
    };

    // ───────── JOB DATA ─────────
    private static final String[][] JOBS_DATA = {
        // {title, department, description, experience, jobType, location, salaryRange, skills (comma separated), preferredSkills}
        {"Software Development Engineer", "Engineering", "Design, develop, and maintain scalable software solutions for our core platform. Collaborate with cross-functional teams to deliver high-quality features that impact millions of users.", "Fresher", "Full-Time", "Bangalore", "₹12-18 LPA", "Java,Spring Boot,SQL,REST APIs", "Microservices,Docker,Kubernetes"},
        {"Software Development Engineer II", "Engineering", "Lead the design and implementation of complex distributed systems. Mentor junior engineers and drive architectural decisions for mission-critical services.", "2-4 years", "Full-Time", "Bangalore", "₹22-35 LPA", "Java,System Design,AWS,Microservices", "Kafka,Redis,GraphQL"},
        {"Frontend Developer", "Engineering", "Build beautiful, responsive user interfaces using modern JavaScript frameworks. Work closely with designers and product managers to create exceptional user experiences.", "Fresher", "Full-Time", "Hyderabad", "₹10-16 LPA", "React,JavaScript,TypeScript,CSS", "Next.js,Tailwind CSS,GraphQL"},
        {"Senior Frontend Engineer", "Engineering", "Architect and build the next generation of our web platform. Drive performance optimization and establish frontend best practices across the organization.", "3-5 years", "Full-Time", "Bangalore", "₹28-42 LPA", "React,TypeScript,Performance Optimization,System Design", "Micro-frontends,Web Components,SSR"},
        {"Backend Developer", "Engineering", "Build robust server-side applications and APIs. Design efficient database schemas and optimize query performance for high-traffic applications.", "0-2 years", "Full-Time", "Pune", "₹10-15 LPA", "Python,Django,PostgreSQL,REST APIs", "Redis,Celery,Docker"},
        {"Full Stack Developer", "Engineering", "Work across the entire stack to deliver end-to-end features. From database design to pixel-perfect UIs, you'll own the complete development lifecycle.", "1-3 years", "Full-Time", "Noida", "₹14-22 LPA", "React,Node.js,MongoDB,Express.js", "TypeScript,AWS,CI/CD"},
        {"Data Scientist", "Data Science", "Apply machine learning and statistical techniques to solve complex business problems. Build predictive models and derive actionable insights from large datasets.", "0-2 years", "Full-Time", "Bangalore", "₹15-25 LPA", "Python,Machine Learning,SQL,Statistics", "TensorFlow,PyTorch,Spark"},
        {"Senior Data Scientist", "Data Science", "Lead data science initiatives across multiple product verticals. Design experimentation frameworks and build ML pipelines that directly impact business metrics.", "3-5 years", "Full-Time", "Gurgaon", "₹30-50 LPA", "Machine Learning,Deep Learning,Python,A/B Testing", "MLOps,Recommendation Systems,NLP"},
        {"Data Analyst", "Analytics", "Analyze large datasets to identify trends and generate reports that drive business decisions. Build dashboards and automate reporting workflows.", "Fresher", "Full-Time", "Mumbai", "₹8-12 LPA", "SQL,Python,Excel,Tableau", "Power BI,Google Analytics,Statistics"},
        {"ML Engineer", "AI/ML", "Design and deploy production-ready machine learning models. Build end-to-end ML pipelines and optimize model performance at scale.", "1-3 years", "Full-Time", "Bangalore", "₹18-30 LPA", "Python,TensorFlow,PyTorch,MLOps", "Kubernetes,Kubeflow,Feature Engineering"},
        {"DevOps Engineer", "Infrastructure", "Build and maintain CI/CD pipelines, container orchestration, and infrastructure automation. Ensure high availability and reliability of production systems.", "1-3 years", "Full-Time", "Hyderabad", "₹14-24 LPA", "AWS,Docker,Kubernetes,Terraform", "Jenkins,Ansible,Prometheus,Grafana"},
        {"Site Reliability Engineer", "Infrastructure", "Ensure the reliability and scalability of our distributed systems. Design monitoring solutions and drive incident response processes.", "2-4 years", "Full-Time", "Bangalore", "₹25-40 LPA", "Linux,Python,Kubernetes,Monitoring", "SRE Practices,Chaos Engineering,GCP"},
        {"Cloud Architect", "Infrastructure", "Design and implement cloud-native architectures on major cloud platforms. Define cloud strategy and governance frameworks for the organization.", "5-8 years", "Full-Time", "Pune", "₹40-60 LPA", "AWS,Azure,GCP,Terraform", "Multi-cloud,Serverless,Security"},
        {"Product Manager", "Product", "Define product vision and roadmap based on user research and data analysis. Work with engineering teams to deliver features that delight customers.", "2-5 years", "Full-Time", "Bangalore", "₹25-45 LPA", "Product Strategy,User Research,Agile,SQL", "A/B Testing,Figma,Data Analytics"},
        {"Associate Product Manager", "Product", "Support the product team in researching user needs, defining requirements, and tracking feature delivery. Great entry point into product management.", "Fresher", "Full-Time", "Mumbai", "₹12-18 LPA", "Analytical Thinking,Communication,SQL,Figma", "Jira,User Interviews,Wireframing"},
        {"UI/UX Designer", "Design", "Create intuitive and visually stunning user interfaces. Conduct user research, create wireframes, prototypes, and design systems that scale across products.", "1-3 years", "Full-Time", "Bangalore", "₹12-20 LPA", "Figma,Adobe XD,User Research,Prototyping", "Design Systems,Motion Design,Accessibility"},
        {"QA Engineer", "Engineering", "Design and execute comprehensive test strategies. Build automated test frameworks and ensure the quality of every release.", "0-2 years", "Full-Time", "Chennai", "₹8-14 LPA", "Selenium,Java,Test Automation,API Testing", "Cypress,JMeter,Performance Testing"},
        {"iOS Developer", "Mobile", "Build and maintain our iOS application using Swift and SwiftUI. Deliver smooth, performant mobile experiences for millions of users.", "1-3 years", "Full-Time", "Bangalore", "₹16-28 LPA", "Swift,SwiftUI,iOS SDK,Core Data", "Combine,MVVM,CI/CD for Mobile"},
        {"Android Developer", "Mobile", "Develop high-quality Android applications using Kotlin and Jetpack Compose. Collaborate with design and product teams to build features users love.", "1-3 years", "Full-Time", "Hyderabad", "₹14-26 LPA", "Kotlin,Jetpack Compose,Android SDK,MVVM", "Coroutines,Dagger/Hilt,Room"},
        {"Cybersecurity Analyst", "Security", "Monitor and protect our infrastructure against security threats. Conduct vulnerability assessments and implement security best practices across the organization.", "1-3 years", "Full-Time", "Noida", "₹12-22 LPA", "Network Security,SIEM,Penetration Testing,Linux", "OWASP,SOC Operations,Incident Response"},
        {"Technical Writer", "Engineering", "Create clear, comprehensive technical documentation for APIs, SDKs, and internal tools. Work with engineering teams to keep documentation accurate and up to date.", "0-2 years", "Full-Time", "Pune", "₹8-14 LPA", "Technical Writing,API Documentation,Markdown,Git", "Swagger/OpenAPI,Developer Experience"},
        {"Blockchain Developer", "Engineering", "Design and implement smart contracts and decentralized applications. Build the infrastructure for our Web3 initiatives.", "1-3 years", "Full-Time", "Bangalore", "₹20-35 LPA", "Solidity,Ethereum,Web3.js,Smart Contracts", "DeFi,Layer 2,Rust"},
        {"Embedded Systems Engineer", "Hardware", "Design firmware and embedded software for IoT devices. Work with hardware teams to bring connected products from prototype to production.", "0-2 years", "Full-Time", "Chennai", "₹10-16 LPA", "C,C++,RTOS,ARM", "IoT Protocols,PCB Design,FPGA"},
        {"Business Analyst", "Strategy", "Bridge the gap between business stakeholders and technology teams. Translate business requirements into technical specifications and track project delivery.", "0-2 years", "Full-Time", "Mumbai", "₹8-14 LPA", "SQL,Excel,Requirements Gathering,Agile", "BPMN,Tableau,JIRA"},
        {"AI Research Intern", "Research", "Work on cutting-edge AI research projects including LLMs, computer vision, and reinforcement learning. Publish papers and prototype novel solutions.", "Fresher", "Internship", "Bangalore", "₹50K-80K/month", "Python,Deep Learning,Research,PyTorch", "Transformers,NLP,Computer Vision"},
        {"Summer Engineering Intern", "Engineering", "Join a product team for a 2-month summer internship. Build real features, attend design reviews, and present your work to leadership at the end.", "Fresher", "Internship", "Bangalore", "₹40K-60K/month", "DSA,Programming,Problem Solving", "Java,Python,Web Development"},
        {"Data Engineering Intern", "Data", "Build and optimize data pipelines. Work with the data platform team to process and transform large-scale datasets.", "Fresher", "Internship", "Gurgaon", "₹35K-55K/month", "Python,SQL,Apache Spark,ETL", "Airflow,dbt,AWS Glue"},
        {"Graduate Trainee - Technology", "Engineering", "12-month graduate training program covering multiple technology domains. Rotate through teams, receive mentorship, and find your ideal engineering role.", "Fresher", "Full-Time", "Pan India", "₹6-10 LPA", "Programming,DSA,Problem Solving,Communication", "Any programming language"},
        {"Platform Engineer", "Infrastructure", "Build the internal developer platform that powers engineering productivity. Create tools, services, and abstractions that help teams ship faster.", "2-4 years", "Full-Time", "Bangalore", "₹22-36 LPA", "Go,Kubernetes,gRPC,Platform Engineering", "Service Mesh,GitOps,Backstage"},
        {"NLP Engineer", "AI/ML", "Build natural language processing pipelines for text classification, entity extraction, and conversational AI. Deploy models that power our intelligent features.", "1-3 years", "Full-Time", "Hyderabad", "₹18-30 LPA", "Python,NLP,Transformers,spaCy", "LLMs,RAG,LangChain"}
    };

    // ───────── MAIN SEED METHOD ─────────
    public Map<String, Object> seed(String demoPassword) {
        // Clean all tables (order matters for FK constraints)
        applicationRepository.deleteAll();
        notificationRepository.deleteAll();
        jobRepository.deleteAll();
        studentProfileRepository.deleteAll();
        studentRepository.deleteAll();
        recruiterRepository.deleteAll();
        userRepository.deleteAll();

        String encodedPassword = passwordEncoder.encode(demoPassword);
        List<Map<String, Object>> results = new ArrayList<>();
        Set<String> usedEmails = new HashSet<>();

        // ─── Create 25 Recruiters ───
        List<Recruiter> recruiters = new ArrayList<>();
        for (int i = 0; i < 25; i++) {
            String[] company = COMPANIES[i];
            boolean female = rng.nextBoolean();
            String first = female ? pick(FIRST_NAMES_FEMALE) : pick(FIRST_NAMES_MALE);
            String last = pick(LAST_NAMES);
            String name = first + " " + last;
            String email = first.toLowerCase() + "." + last.toLowerCase() + "@" + company[2];
            if (usedEmails.contains(email)) {
                email = first.toLowerCase() + "." + last.toLowerCase() + (10 + i) + "@" + company[2];
            }
            usedEmails.add(email);

            User u = new User(email, encodedPassword, "recruiter");
            u = userRepository.save(u);

            Recruiter r = new Recruiter();
            r.setUserId(u.getId());
            r.setCompanyName(company[0]);
            r.setRecruiterName(name);
            r.setEmail(email);
            r.setDesignation(pick(RECRUITER_DESIGNATIONS));
            r.setCompanyWebsite(company[1]);
            r = recruiterRepository.save(r);
            recruiters.add(r);

            results.add(Map.of("email", email, "role", "recruiter", "company", company[0], "userId", u.getId()));
        }

        // ─── Create Jobs (2-4 per recruiter, ~60-75 jobs) ───
        List<Job> allJobs = new ArrayList<>();
        List<String[]> jobPool = new ArrayList<>(Arrays.asList(JOBS_DATA));
        // Shuffle to distribute jobs across recruiters
        Collections.shuffle(jobPool, rng);

        String[] locations = {"Bangalore", "Hyderabad", "Pune", "Mumbai", "Chennai", "Noida", "Gurgaon", "Delhi NCR", "Kolkata", "Ahmedabad", "Jaipur", "Kochi", "Thiruvananthapuram", "Chandigarh", "Pan India", "Remote"};
        int jobIdx = 0;
        for (Recruiter rec : recruiters) {
            int jobCount = 2 + rng.nextInt(3); // 2-4 jobs per recruiter
            for (int j = 0; j < jobCount; j++) {
                String[] jd = jobPool.get(jobIdx % jobPool.size());
                jobIdx++;

                Job job = new Job();
                job.setRecruiterId(rec.getId());
                job.setTitle(jd[0]);
                job.setDepartment(jd[1]);
                job.setDescription(jd[2]);
                job.setExperienceRequired(jd[3]);
                job.setJobType(jd[4]);
                job.setLocation(jd[5].equals("Bangalore") ? pick(locations) : jd[5]); // randomize some locations
                job.setSalaryRange(jd[6]);
                job.setRequiredSkills(new ArrayList<>(Arrays.asList(jd[7].split(","))));
                if (jd.length > 8 && jd[8] != null) {
                    job.setPreferredSkills(new ArrayList<>(Arrays.asList(jd[8].split(","))));
                }
                job.setNumOpenings(1 + rng.nextInt(5));
                job.setStatus("active");
                job.setCompanyDescription(rec.getCompanyName() + " is one of India's leading technology companies, driving innovation across industries.");
                job.setDeadline(LocalDateTime.now().plusDays(15 + rng.nextInt(45)));
                job.setCreatedAt(LocalDateTime.now().minusDays(rng.nextInt(30)));
                job = jobRepository.save(job);
                allJobs.add(job);
            }
        }

        // ─── Create 200 Students ───
        List<Student> students = new ArrayList<>();
        for (int i = 0; i < 200; i++) {
            boolean female = rng.nextBoolean();
            String first = female ? pick(FIRST_NAMES_FEMALE) : pick(FIRST_NAMES_MALE);
            String last = pick(LAST_NAMES);
            String institution = pick(INSTITUTIONS);
            String domain = getEmailDomain(institution);
            String emailBase = first.toLowerCase() + "." + last.toLowerCase();
            String email = emailBase + (20 + i) + "@" + domain;

            // Ensure unique
            while (usedEmails.contains(email)) {
                email = emailBase + (200 + rng.nextInt(800)) + "@" + domain;
            }
            usedEmails.add(email);

            User u = new User(email, encodedPassword, "student");
            u = userRepository.save(u);

            Student s = new Student();
            s.setUserId(u.getId());
            s.setName(first + " " + last);
            s.setEmail(email);
            s.setInstitution(institution);
            s.setDegree(pick(DEGREES));
            s.setBranch(pick(BRANCHES));
            s.setGraduationYear(2024 + rng.nextInt(3)); // 2024, 2025, 2026
            s.setPhone("+91 " + pick(PHONE_PREFIXES) + String.format("%08d", rng.nextInt(100000000)));
            s.setProfileComplete(rng.nextDouble() < 0.75); // 75% have complete profiles
            s.setCreatedAt(LocalDateTime.now().minusDays(rng.nextInt(90)));
            s = studentRepository.save(s);
            students.add(s);

            // Create Student Profile
            if (s.getProfileComplete()) {
                StudentProfile sp = new StudentProfile();
                sp.setStudentId(s.getId());
                sp.setGithubUrl("https://github.com/" + first.toLowerCase() + last.toLowerCase());
                sp.setLinkedinUrl("https://linkedin.com/in/" + first.toLowerCase() + last.toLowerCase());
                sp.setLeetcodeUrl("https://leetcode.com/" + first.toLowerCase() + last.toLowerCase());
                sp.setGithubData("{\"repos\": 15, \"commits_last_year\": 450, \"top_languages\": [\"Java\", \"Python\", \"JavaScript\"]}");
                sp.setLeetcodeData("{\"solved\": 120, \"easy\": 50, \"medium\": 60, \"hard\": 10}");
                sp.setLinkedinData("{\"connections\": \"500+\", \"experience\": \"Intern at Tech Corp\"}");
                sp.setResumeSkills(String.format("[\"%s\", \"Spring Boot\", \"SQL\", \"React\"]", pick(new String[]{"Java", "Python", "C++"})));
                sp.setCreatedAt(s.getCreatedAt());
                studentProfileRepository.save(sp);
            }

            if (i < 5) { // Only show first 5 students in response
                results.add(Map.of("email", email, "role", "student", "name", s.getName(), "institution", institution, "userId", u.getId()));
            }
        }

        // ─── Create Applications (some students apply to jobs) ───
        String[] statuses = {"pending", "under_review", "shortlisted", "rejected", "interview_scheduled"};
        Set<String> appliedPairs = new HashSet<>();
        int applicationCount = 0;

        for (Student student : students) {
            int applyCount = rng.nextInt(5); // 0-4 applications per student
            for (int a = 0; a < applyCount && a < allJobs.size(); a++) {
                Job randomJob = allJobs.get(rng.nextInt(allJobs.size()));
                String pairKey = student.getId() + ":" + randomJob.getId();
                if (appliedPairs.contains(pairKey)) continue;
                appliedPairs.add(pairKey);

                Application app = new Application();
                app.setStudentId(student.getId());
                app.setJobId(randomJob.getId());
                app.setStatus(statuses[rng.nextInt(statuses.length)]);
                app.setAppliedAt(LocalDateTime.now().minusDays(rng.nextInt(30)));
                applicationRepository.save(app);
                applicationCount++;

                // Update job application count
                randomJob.setApplicationsCount(randomJob.getApplicationsCount() + 1);
                jobRepository.save(randomJob);
            }
        }

        // ─── Create Notifications ───
        String[] notifTypes = {"application_update", "interview_scheduled", "job_match", "profile_reminder", "system"};
        String[][] notifTemplates = {
            {"Application Status Updated", "Your application for %s has been updated to %s.", "/student/applications"},
            {"Interview Scheduled", "Your interview with %s has been scheduled. Check your interviews page for details.", "/student/interviews"},
            {"New Job Match", "A new job matching your skills has been posted: %s at %s.", "/student/jobs"},
            {"Complete Your Profile", "Your profile is 80%% complete. Add your skills and projects to improve visibility.", "/student/profile"},
            {"Welcome to SudheeAI", "Welcome! Start exploring job opportunities and prepare with our AI interview simulator.", "/student/dashboard"}
        };
        int notifCount = 0;
        for (int i = 0; i < Math.min(50, students.size()); i++) {
            Student s = students.get(i);
            int nCount = 1 + rng.nextInt(4);
            for (int n = 0; n < nCount; n++) {
                int tIdx = rng.nextInt(notifTemplates.length);
                Notification notif = new Notification();
                notif.setUserId(s.getUserId());
                notif.setType(notifTypes[tIdx]);
                notif.setTitle(notifTemplates[tIdx][0]);
                if (tIdx == 0 && !allJobs.isEmpty()) {
                    Job rj = allJobs.get(rng.nextInt(allJobs.size()));
                    notif.setMessage(String.format(notifTemplates[tIdx][1], rj.getTitle(), statuses[rng.nextInt(statuses.length)]));
                } else if (tIdx == 2 && !allJobs.isEmpty()) {
                    Job rj = allJobs.get(rng.nextInt(allJobs.size()));
                    notif.setMessage(String.format(notifTemplates[tIdx][1], rj.getTitle(), recruiters.get(rng.nextInt(recruiters.size())).getCompanyName()));
                } else {
                    notif.setMessage(notifTemplates[tIdx][1].replace("%s", "SudheeAI"));
                }
                notif.setLink(notifTemplates[tIdx][2]);
                notif.setIsRead(rng.nextBoolean());
                notif.setCreatedAt(LocalDateTime.now().minusHours(rng.nextInt(720)));
                notificationRepository.save(notif);
                notifCount++;
            }
        }

        // ─── Create Admin ───
        User admin = new User("admin@hirehub.com", encodedPassword, "admin");
        admin = userRepository.save(admin);
        results.add(Map.of("email", admin.getEmail(), "role", "admin", "userId", admin.getId()));

        Map<String, Object> response = new HashMap<>();
        response.put("summary", Map.of(
            "students", students.size(),
            "recruiters", recruiters.size(),
            "jobs", allJobs.size(),
            "applications", applicationCount,
            "notifications", notifCount
        ));
        response.put("password", demoPassword);
        response.put("sampleAccounts", results);
        return response;
    }

    private String pick(String[] arr) {
        return arr[rng.nextInt(arr.length)];
    }
}
