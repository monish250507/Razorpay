import sys
import os

# Add the project root to the python path so imports like `services.something` work correctly.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
