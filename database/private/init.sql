CREATE TABLE academic_records (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL,
  course_code VARCHAR(20) NOT NULL,
  course_title VARCHAR(160) NOT NULL,
  semester VARCHAR(30) NOT NULL,
  marks INTEGER NOT NULL CHECK (marks BETWEEN 0 AND 100),
  grade VARCHAR(4) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE financial_records (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL,
  description VARCHAR(180) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('fee', 'payment', 'scholarship')),
  payment_status VARCHAR(20) NOT NULL CHECK (payment_status IN ('paid', 'pending', 'overdue')),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Student ID 1 belongs to the seeded student created by the public API on startup.
INSERT INTO academic_records (student_id, course_code, course_title, semester, marks, grade) VALUES
  (1, '23MX31', 'Cloud Computing', 'Semester 5', 91, 'A+'),
  (1, '23MX32', 'Web Application Development', 'Semester 5', 86, 'A'),
  (1, '23MX33', 'Database Management Systems', 'Semester 4', 89, 'A+')
ON CONFLICT DO NOTHING;

INSERT INTO financial_records (student_id, description, amount, transaction_type, payment_status, transaction_date) VALUES
  (1, 'Semester 5 tuition fee', 45000.00, 'fee', 'paid', '2026-07-10'),
  (1, 'Merit scholarship credit', -5000.00, 'scholarship', 'paid', '2026-07-18'),
  (1, 'Laboratory fee', 2500.00, 'fee', 'pending', '2026-09-01')
ON CONFLICT DO NOTHING;
