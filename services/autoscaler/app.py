import os
import subprocess
import time
import requests

# Configurable Scaling Policies
MIN_REPLICAS = int(os.getenv("MIN_REPLICAS", "1"))
MAX_REPLICAS = int(os.getenv("MAX_REPLICAS", "3"))
CPU_SCALE_UP = float(os.getenv("CPU_SCALE_UP", "70"))
CPU_SCALE_DOWN = float(os.getenv("CPU_SCALE_DOWN", "30"))
REQUEST_THRESHOLD = float(os.getenv("REQUEST_THRESHOLD", "100"))
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))

PROJECT_DIR = "/project"

last_requests = 0
last_check_time = time.time()

def get_traffic_rate():
    global last_requests, last_check_time
    try:
        r = requests.get("http://proxy:80/nginx_status", timeout=2)
        if r.status_code == 200:
            lines = r.text.split('\n')
            # Output format:
            # Active connections: 1 
            # server accepts handled requests
            #  10 10 20 
            reqs = int(lines[2].split()[2])
            now = time.time()
            elapsed = now - last_check_time
            rate = (reqs - last_requests) / elapsed if last_requests > 0 and elapsed > 0 else 0
            last_requests = reqs
            last_check_time = now
            return rate
    except Exception as e:
        print(f"[Autoscaler] Error fetching Nginx stats: {e}")
    return 0

def get_cpu_usage():
    try:
        result = subprocess.run(
            ["docker", "stats", "--no-stream", "--format", "{{.Name}}:{{.CPUPerc}}"],
            capture_output=True, text=True, check=True
        )
        cpu_percentages = []
        for line in result.stdout.strip().split("\n"):
            if "public-api" in line:
                parts = line.split(":")
                if len(parts) == 2:
                    cpu_str = parts[1].replace("%", "").strip()
                    cpu_percentages.append(float(cpu_str))
        
        if cpu_percentages:
            return sum(cpu_percentages) / len(cpu_percentages)
    except Exception as e:
        print(f"[Autoscaler] Error fetching Docker stats: {e}")
    return 0

def get_current_replicas():
    try:
        result = subprocess.run(
            ["docker", "compose", "ps", "public-api", "--format", "json"],
            cwd=PROJECT_DIR, capture_output=True, text=True, check=True
        )
        lines = [line for line in result.stdout.strip().split("\n") if line.strip()]
        return len(lines)
    except Exception as e:
        print(f"[Autoscaler] Error checking replicas: {e}")
    return 1

def scale_to(replicas):
    print(f"[Autoscaler] Scaling public-api to {replicas} replicas...")
    try:
        subprocess.run(
            ["docker", "compose", "up", "-d", "--scale", f"public-api={replicas}", "--no-recreate"],
            cwd=PROJECT_DIR, check=True
        )
        print(f"[Autoscaler] Scaling complete.")
    except subprocess.CalledProcessError as e:
        print(f"[Autoscaler] Failed to scale: {e}")

def main():
    print("=" * 50)
    print("HYBRID CLOUD AUTOSCALING ENGINE")
    print(f"Policy: MIN={MIN_REPLICAS}, MAX={MAX_REPLICAS}")
    print(f"Thresholds: CPU UP > {CPU_SCALE_UP}%, CPU DOWN < {CPU_SCALE_DOWN}%, REQ > {REQUEST_THRESHOLD}/s")
    print("=" * 50)
    
    # Initialize baseline
    get_traffic_rate()

    while True:
        time.sleep(POLL_INTERVAL)
        
        traffic_rate = get_traffic_rate()
        cpu_usage = get_cpu_usage()
        current_replicas = get_current_replicas()
        
        print(f"[Metrics] Traffic: {traffic_rate:.1f} req/s | CPU: {cpu_usage:.1f}% | Replicas: {current_replicas}")
        
        desired_replicas = current_replicas
        
        if cpu_usage > CPU_SCALE_UP or traffic_rate > REQUEST_THRESHOLD:
            desired_replicas = MAX_REPLICAS
        elif (cpu_usage > CPU_SCALE_DOWN and cpu_usage <= CPU_SCALE_UP) or (traffic_rate > REQUEST_THRESHOLD/2 and traffic_rate <= REQUEST_THRESHOLD):
            desired_replicas = max(2, MIN_REPLICAS)
        elif cpu_usage <= CPU_SCALE_DOWN and traffic_rate <= REQUEST_THRESHOLD/2:
            desired_replicas = MIN_REPLICAS
            
        desired_replicas = max(MIN_REPLICAS, min(desired_replicas, MAX_REPLICAS))
        
        if desired_replicas != current_replicas:
            print(f"[Autoscaler] Action: Modifying replica count from {current_replicas} -> {desired_replicas}")
            scale_to(desired_replicas)

if __name__ == "__main__":
    main()
