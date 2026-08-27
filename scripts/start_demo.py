import subprocess
import time
import urllib.request
import json
import sys
import os

NGROK_PATH = "ngrok"
WORKSPACE_NGROK_PATH = os.path.abspath("ngrok.exe")

def get_ngrok_cmd():
    try:
        subprocess.run(["ngrok", "version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return "ngrok"
    except FileNotFoundError:
        if os.path.exists(WORKSPACE_NGROK_PATH):
            return WORKSPACE_NGROK_PATH
        print("CRITICAL ERROR: 'ngrok' command not found.")
        print("Please install ngrok and ensure it is in your system PATH, or authenticate if required.")
        sys.exit(1)
    except subprocess.CalledProcessError:
        print("CRITICAL ERROR: 'ngrok' is installed but failed to execute properly.")
        sys.exit(1)

def main():
    print("==================================================")
    print("STARTING Hallucion DEMO ENVIRONMENT")
    print("==================================================")

    ngrok_cmd = get_ngrok_cmd()

    # Start FastAPI backend
    print("-> Starting FastAPI backend on port 5000...")
    backend = subprocess.Popen([sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"])

    # Wait a second for backend to initialize before starting tunnel
    time.sleep(2)

    # Start ngrok
    print("-> Starting ngrok tunnel on port 5000...")
    ngrok = subprocess.Popen([ngrok_cmd, "http", "5000"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Wait for ngrok to establish tunnel
    print(" Waiting for tunnel connection...")
    time.sleep(4)

    public_url = None
    try:
        req = urllib.request.Request("http://127.0.0.1:4040/api/tunnels")
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            if data.get('tunnels'):
                public_url = data['tunnels'][0]['public_url']
            else:
                raise Exception("No active tunnels found in ngrok API response.")
                
        print("\n" + "="*70)
        print(" TUNNEL ACTIVE & READY FOR DEMO")
        print("="*70)
        print(f" Public URL: {public_url}")
        print("\n ACTION REQUIRED FOR RAZORPAY WEBHOOK:")
        print("1. Open Razorpay Dashboard -> Account & Settings -> Webhooks")
        print(f"2. Paste exactly this URL: {public_url}/api/webhooks/razorpay")
        print("3. Ensure the RAZORPAY_WEBHOOK_SECRET in your .env matches the dashboard.")
        print(f"4. Verify connection: {public_url}/api/webhooks/razorpay/selftest")
        print("="*70 + "\n")
        print("Press Ctrl+C to stop the servers.")

    except Exception as e:
        print(f"\n Failed to retrieve ngrok URL. Is ngrok authenticated? Error: {e}")
        backend.kill()
        ngrok.kill()
        sys.exit(1)

    try:
        # Keep main thread alive waiting for subprocesses
        backend.wait()
    except KeyboardInterrupt:
        print("\nShutting down demo environment...")
        backend.kill()
        ngrok.kill()
        sys.exit(0)

if __name__ == "__main__":
    main()


