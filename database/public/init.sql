CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  department VARCHAR(100) NOT NULL,
  study_year INTEGER NOT NULL CHECK (study_year BETWEEN 1 AND 6),
  role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admissions (
  id SERIAL PRIMARY KEY,
  applicant_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  programme VARCHAR(120) NOT NULL,
  prior_qualification VARCHAR(160) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE courses (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  title VARCHAR(160) NOT NULL,
  department VARCHAR(100) NOT NULL,
  credits INTEGER NOT NULL CHECK (credits BETWEEN 1 AND 8),
  seats INTEGER NOT NULL DEFAULT 60
);

CREATE TABLE registrations (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  semester VARCHAR(30) NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, course_id, semester)
);

CREATE TABLE materials (
  id SERIAL PRIMARY KEY,
  course_code VARCHAR(20) NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  resource_url VARCHAR(255) NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO courses (code, title, department, credits, seats) VALUES
  ('23MX31', 'Cloud Computing', 'Computer Applications', 4, 60),
  ('23MX32', 'Web Application Development', 'Computer Applications', 4, 60),
  ('23MX33', 'Database Management Systems', 'Computer Applications', 4, 60)
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (course_code, title, description, resource_url) VALUES
  ('23MX31', 'Hybrid Cloud Deployment Models', 'Public, private and hybrid cloud deployment notes.', 'https://example.edu/materials/hybrid-cloud'),
  ('23MX31', 'Load Balancing Lab', 'Lab guide for reverse proxies and application replicas.', 'https://example.edu/materials/load-balancing'),
  ('23MX32', 'REST API Fundamentals', 'Lecture material for secure web APIs.', 'https://example.edu/materials/rest-api')
ON CONFLICT DO NOTHING;
