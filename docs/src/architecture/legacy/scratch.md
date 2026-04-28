<!-- migrated from: dev/scratch.md -->
- Bullets in resume are PER JOB (Work history)
- Chrome extension
	- 50+ job boards
- Cultural Databases (For **Company culture tailoring**)
	- Supports **tone adaptation**
	- Supports **strategic emphasis shifting**
- Cover Letter Features
	- Strategically include JD Keywords
	- GOAL: application immediately communicates your value and relevance for the role
	- [Templates](https://www.jobscan.co/cover-letter-templates)
		- Basic Cover Letter
		- Formal Cover Letter
		- Career Change Cover Letter
		- Operations Manager Cover Letter
		- Pharmacy Tech Cover Letter
		- Project Management Cover Letter
		- Prospecting Cover Letter
		- Engineer Cover Letter
		- Supervisor Cover Letter
		- Human Resources Cover Letter
		- Intern Cover Letter
		- Marketing Cover Letter
		- Networking Cover Letter
		- Communications Cover Letter
		- Changing Careers Cover Letter
- Resume Features
	- Job Description
		- Keyword Matching
		- Match Score
	- Content Scoring
		- Searchability
		- Hard Skills
		- Soft Skills
		- Recruiter Tips
		- Formatting
		- JD Alignment
	- Content Alignment
		- ATS Requirements
		- JD Qualifications
		- JD Requirements
		- JD Preferences
	- Content Review
		- impact checks
		- brevity checks
		- style checks
		- 'Professional Summary' review
		- ATS compatibility checks
	- Templates
		- CPRW-approved
		- ATS-Friendly
		- Highly customizable
	- Versions
		- ATS-optimized (plain, keyword-dense)
		- human-readable (narrative, visually refined)
	- Output
		- PDF
		- DOCX
		- Google Docs
		- LaTeX
		- Markdown (GFMD)
		- JSON
		- HTML
	- Privacy
		- GDPR compliant
	- Integration
		- GitHub profile
			- pull contribution graphs
			- starred repositories
			- open-source project data
		- LinkedIn profile
			- LinkedIn Profile review (w/ profile score)
				- Based on what recruiters are looking for
			- Profile 'Optimization'
				- Get more views, stronger connections, and more job interviews
				- add key skills to your headline, summary, and skills sections
			- tailored summary generation
				- highlights your experience and skills
			- headline generation
				- sum up who you are professionally
				- highlight your unique skills and achievements
			- personalized keyword suggestions
				- align your LinkedIn profile with recruiter searches
		- Stack Overflow
		- technical blog platforms
			- Dev.to
			- Medium
			- blog.example.com
- confidential job search features
	- anonymized profiles
	- delayed publishing
	- current-employer blocking
	- zero-knowledge encryption
- Job Tracking
	- Kanban-style job tracking
- Define Jobs using
	- '**Candidate Persona**': This should describe the 'Kind of person' that the employer wants
		- Based on JD, Hiring History, Employer Profile
	- '**Candidate SPEC**': ~ The 'dream resume' from the Employers perspective
		- Based on the JDs Concept Cluster & Hyper Cluster
	- '**Skills Map**': The JDs  Concept Cluster & Hyper Cluster (Expanded Concept Cluster)
		- Based on the JD, identify concepts/topics, then brainstorm/search/explore related concepts/topics (Hyper Cluster)
	- '**JD profile**'
- Determine 'matches' with **Archetype Match**
- Impact quantifications
	- Senior-level impact quantification frameworks quantify
		- organizational change leadership
		- cross-functional influence on C-suite decisions
		- multi-million dollar budget optimization
		- mentorship pipeline impact
		- strategic contributions
	- Mid-level metrics:
		- "increased efficiency by X%,"
		- "managed team of Y people."
- NEED: help crafting _story_ of why this career trajectory makes the candidate uniquely qualified
	- strategic narrative construction
	- Career arc storytelling across domains
	- intra-domain pivots represent deepening specialization
	- AI doesn't know which of your accomplishments matter most, how to frame your career transitions, or what makes you uniquely valuable
- JD / Resume Analysis should identify
	- Unique Differentiators (What makes me stand out)
	- Gaps in Bullet Coverage
- NEED: Prose Analysis
	- Prose is the standard form of written language, characterized by natural flow, grammatical sentences, and paragraph structure, rather than rhythmic or metrical structures like poetry
- How can we empirically & programmatically detect
	- AI Stink (How likely is it that some text was AI generated)
- Refined Scoring Metrics for
	- SPEC Alignment
	- Skills Map Alignment
	- Persona Alignment
- Refined instructions for 
	- SPEC Generation + Review + Refinement
	- Skills Map Generation + Review + Refinement
	- Persona Generation + Review + Refinement

### 'Resume Object'
```json
{
	"meta":{
		"created":"",
		"updated":"",
		"status":""
	},
	"contact-info":{},
	"target":{
		"jd":[""],
		"id":"",
		"concepts":[
			{
				"id":"",
				"title":"",
				"vectors":[],
			}
		]
	},
	"work-history":[
		{
			"role":"",
			"org":"",
			"date":{
				"start":"",
				"end":""
			},
			"bullets":[
				{
					"source": "",
					"target": "",
					"score": 0.1
				}
			],
		}
	],
	"education":[
		{
		}
	],
	"certifications":[
		{
		}
	],
	"interests":[
		{
		}
	],
	"summary":[""]
}
```
