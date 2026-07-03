export const PHASES = [
  {
    id: "foundations",
    title: "01 - FOUNDATIONS",
    subtitle: "Network Defence & Security Fundamentals",
    color: "#00ffc8",
    hours: 60,
    description: "Build the base. Networking, Linux, cryptography, security principles.",
    modules: [
      {
        name: "Networking Fundamentals",
        tasks: [
          { id: "f1", label: "Complete TryHackMe 'Pre-Security' path", link: "https://tryhackme.com/path/outline/presecurity", hours: 8 },
          { id: "f2", label: "Complete TryHackMe 'Network Fundamentals' room", link: "https://tryhackme.com/module/network-fundamentals", hours: 4 },
          { id: "f3", label: "Set up Wireshark - capture & analyse 10 packet dumps", link: "https://www.wireshark.org/", hours: 6 },
          { id: "f4", label: "Learn TCP/IP, DNS, HTTP, HTTPS, ARP - write cheatsheet", hours: 4 },
        ],
      },
      {
        name: "Linux & Command Line",
        tasks: [
          { id: "f5", label: "Complete OverTheWire 'Bandit' wargame (all levels)", link: "https://overthewire.org/wargames/bandit/", hours: 10 },
          { id: "f6", label: "Set up a Kali Linux VM (VirtualBox or VMware)", link: "https://www.kali.org/", hours: 2 },
          { id: "f7", label: "Bash scripting fundamentals - automate 5 tasks", hours: 6 },
        ],
      },
      {
        name: "Cryptography & Security Principles",
        tasks: [
          { id: "f8", label: "Complete TryHackMe 'Cryptography' module", link: "https://tryhackme.com/module/cryptography", hours: 6 },
          { id: "f9", label: "Study CIA triad, AAA, defense-in-depth - write notes", hours: 3 },
          { id: "f10", label: "Implement basic encryption/decryption in Python", hours: 4 },
          { id: "f11", label: "Complete TryHackMe 'Intro to Cyber Security' path", link: "https://tryhackme.com/path/outline/introtocyber", hours: 7 },
        ],
      },
    ],
  },
  {
    id: "soc",
    title: "02 - SOC OPERATIONS",
    subtitle: "Detection, Monitoring & Incident Response",
    color: "#ff6b35",
    hours: 50,
    description: "50 hours of live SOC-equivalent work - detection, triage, escalation.",
    modules: [
      {
        name: "SOC Setup & SIEM",
        tasks: [
          { id: "s1", label: "Deploy Security Onion or Wazuh on a VM", link: "https://securityonionsolutions.com/", hours: 4 },
          { id: "s2", label: "Set up ELK Stack (Elasticsearch, Logstash, Kibana)", link: "https://www.elastic.co/elastic-stack", hours: 5 },
          { id: "s3", label: "Configure log collection from 3+ sources", hours: 3 },
          { id: "s4", label: "Create detection rules for common attack patterns", hours: 4 },
        ],
      },
      {
        name: "Tier-1 SOC Analyst Training",
        tasks: [
          { id: "s5", label: "Complete TryHackMe 'SOC Level 1' path", link: "https://tryhackme.com/path/outline/soclevel1", hours: 12 },
          { id: "s6", label: "Analyse 20 PCAP files for malicious activity", hours: 6 },
          { id: "s7", label: "Practice alert triage - document 15 incident reports", hours: 6 },
          { id: "s8", label: "Study MITRE ATT&CK framework - map 10 techniques", link: "https://attack.mitre.org/", hours: 5 },
        ],
      },
      {
        name: "Incident Response",
        tasks: [
          { id: "s9", label: "Write an Incident Response playbook (phishing, malware, DDoS)", hours: 5 },
          { id: "s10", label: "Complete Blue Team Labs Online challenges (5+)", link: "https://blueteamlabs.online/", hours: 8 },
          { id: "s11", label: "Practice threat escalation - document decision trees", hours: 3 },
        ],
      },
    ],
  },
  {
    id: "offense",
    title: "03 - ETHICAL HACKING",
    subtitle: "Penetration Testing & Vulnerability Assessment",
    color: "#ff2d6b",
    hours: 60,
    description: "Attack to understand defense. VAPT skills, exploit development, web app hacking.",
    modules: [
      {
        name: "Web Application Security",
        tasks: [
          { id: "o1", label: "Set up DVWA locally", link: "https://github.com/digininja/DVWA", hours: 2 },
          { id: "o2", label: "Complete OWASP Top 10 - exploit each vulnerability", link: "https://owasp.org/www-project-top-ten/", hours: 10 },
          { id: "o3", label: "Complete TryHackMe 'Web Fundamentals' path", link: "https://tryhackme.com/path/outline/web", hours: 8 },
          { id: "o4", label: "Practice with Burp Suite on vulnerable apps", link: "https://portswigger.net/burp/communitydownload", hours: 6 },
        ],
      },
      {
        name: "Penetration Testing",
        tasks: [
          { id: "o5", label: "Complete HackTheBox 'Starting Point' (all tiers)", link: "https://www.hackthebox.com/", hours: 10 },
          { id: "o6", label: "Root 10 HackTheBox machines (Easy to Medium)", hours: 15 },
          { id: "o7", label: "Learn Metasploit framework - complete 5 exploit chains", hours: 6 },
          { id: "o8", label: "Write a professional VAPT report for one engagement", hours: 5 },
        ],
      },
      {
        name: "CTF Competition Prep",
        tasks: [
          { id: "o9", label: "Complete PicoCTF challenges (50+)", link: "https://picoctf.org/", hours: 10 },
          { id: "o10", label: "Participate in 3 live CTF competitions", link: "https://ctftime.org/", hours: 12 },
        ],
      },
    ],
  },
  {
    id: "forensics",
    title: "04 - DIGITAL FORENSICS",
    subtitle: "Investigation, Evidence & Analysis",
    color: "#a855f7",
    hours: 40,
    description: "Evidence handling, disk/memory forensics, chain of custody.",
    modules: [
      {
        name: "Forensic Fundamentals",
        tasks: [
          { id: "d1", label: "Install Autopsy & Sleuth Kit - analyse a disk image", link: "https://www.autopsy.com/", hours: 5 },
          { id: "d2", label: "Complete TryHackMe 'Digital Forensics' rooms", link: "https://tryhackme.com/", hours: 8 },
          { id: "d3", label: "Study chain of custody procedures - document a process", hours: 3 },
        ],
      },
      {
        name: "Memory & Network Forensics",
        tasks: [
          { id: "d4", label: "Use Volatility for memory analysis (5 dumps)", link: "https://www.volatilityfoundation.org/", hours: 8 },
          { id: "d5", label: "Analyse network forensic captures with NetworkMiner", hours: 6 },
          { id: "d6", label: "Complete CyberDefenders.org challenges (5+)", link: "https://cyberdefenders.org/", hours: 10 },
        ],
      },
    ],
  },
  {
    id: "governance",
    title: "05 - GOVERNANCE & STRATEGY",
    subtitle: "Frameworks, Compliance & Leadership",
    color: "#38bdf8",
    hours: 30,
    description: "Governance, risk management, compliance, security architecture.",
    modules: [
      {
        name: "Frameworks & Standards",
        tasks: [
          { id: "g1", label: "Study NIST Cybersecurity Framework", link: "https://www.nist.gov/cyberframework", hours: 5 },
          { id: "g2", label: "Study ISO 27001 - map controls to a sample org", hours: 5 },
          { id: "g3", label: "Learn CIS Controls - prioritise top 10", link: "https://www.cisecurity.org/controls", hours: 4 },
        ],
      },
      {
        name: "Risk & Compliance",
        tasks: [
          { id: "g4", label: "Conduct a risk assessment for a mock organisation", hours: 6 },
          { id: "g5", label: "Write a security policy document (acceptable use, IR, BCP)", hours: 5 },
          { id: "g6", label: "Study GDPR / local data protection laws", hours: 5 },
        ],
      },
    ],
  },
  {
    id: "certs",
    title: "06 - CERTIFICATION TRACK",
    subtitle: "Prove It - External Validation",
    color: "#facc15",
    hours: 0,
    description: "Structured certs to replace the degree signal.",
    modules: [
      {
        name: "Certification Roadmap",
        tasks: [
          { id: "c1", label: "CompTIA Security+ (foundational)", link: "https://www.comptia.org/certifications/security", hours: 0 },
          { id: "c2", label: "CompTIA CySA+ (SOC analyst)", link: "https://www.comptia.org/certifications/cybersecurity-analyst", hours: 0 },
          { id: "c3", label: "eJPT or CEH (ethical hacking entry)", link: "https://ine.com/learning/certifications/internal/elearnsecurity-junior-penetration-tester", hours: 0 },
          { id: "c4", label: "OSCP (gold standard pentest)", link: "https://www.offsec.com/courses/pen-200/", hours: 0 },
          { id: "c5", label: "BTL1 (Blue Team Level 1)", link: "https://www.securityblue.team/certifications/blue-team-level-1", hours: 0 },
        ],
      },
    ],
  },
];

export const PLATFORMS = [
  { name: "TryHackMe", url: "https://tryhackme.com" },
  { name: "HackTheBox", url: "https://www.hackthebox.com" },
  { name: "PicoCTF", url: "https://picoctf.org" },
  { name: "OverTheWire", url: "https://overthewire.org" },
  { name: "CyberDefenders", url: "https://cyberdefenders.org" },
  { name: "Blue Team Labs", url: "https://blueteamlabs.online" },
  { name: "CTFtime", url: "https://ctftime.org" },
  { name: "VulnHub", url: "https://www.vulnhub.com" },
  { name: "MITRE ATT&CK", url: "https://attack.mitre.org" },
];

export const ASSESSMENT_DRILLS = [
  {
    id: "investigate-phishing-alert-t1566",
    title: "Investigate phishing alert",
    phase: "SOC",
    attackTechnique: "T1566.002",
    reference: "MITRE ATT&CK T1566.002 + NIST SP 800-61r3",
    maxScore: 7,
    checklist: [
      "Classify the lure and delivery path without opening live links",
      "Extract sender, reply-to, URL domain, attachment hash, and mailbox rule evidence",
      "Decide if the alert is isolated, related to a campaign, or needs escalation",
      "Write containment actions for mailbox, identity, and endpoint owners",
      "Record confidence, unknowns, and a safe user-facing advisory",
      "Map the finding to ATT&CK and the incident-response phase",
      "Keep raw message bodies, secrets, and client identifiers outside this tracker",
    ],
    evidenceFields: [
      "sender",
      "reply-to",
      "url domain",
      "attachment hash",
      "mailbox rule",
      "recipient count",
      "identity signal",
    ],
    expectedArtifacts: [
      "triage summary",
      "indicator list",
      "containment note",
      "user advisory",
      "unknowns list",
    ],
    scoringFocus: "classification, evidence handling, campaign judgement, containment quality",
  },
  {
    id: "triage-phishing-t1566",
    title: "Phishing alert triage",
    phase: "SOC",
    attackTechnique: "T1566",
    reference: "NIST SP 800-61r3",
    maxScore: 5,
    checklist: [
      "Capture sender, recipient, subject, and received time",
      "Separate indicators from user-visible lure text",
      "Map the lure to ATT&CK and decide escalation",
      "Write one containment recommendation without deleting evidence",
      "Record what remains unknown",
    ],
  },
  {
    id: "powershell-t1059",
    title: "PowerShell execution review",
    phase: "SOC",
    attackTechnique: "T1059.001",
    reference: "MITRE ATT&CK",
    maxScore: 5,
    checklist: [
      "Identify encoded, download, hidden-window, or policy-bypass behavior",
      "Preserve command line and parent-process context",
      "Classify benign admin, suspicious, or malicious-like activity",
      "Name the evidence source used for confidence",
      "Write a short responder note",
    ],
  },
  {
    id: "incident-handoff-csf",
    title: "Incident handoff summary",
    phase: "IR",
    attackTechnique: "CSF-RS",
    reference: "NIST CSF 2.0",
    maxScore: 5,
    checklist: [
      "State the impact in business language",
      "List evidence already preserved",
      "List actions not yet taken",
      "Assign owner and next deadline",
      "Mark the case ready for follow-up review",
    ],
  },
];
