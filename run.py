# FILE: run.py

import sys
import os
import webbrowser
import threading
from pathlib import Path
import time
import logging
import traceback

# --- Third-party imports ---
from waitress import serve
from pystray import MenuItem, Icon, Menu
from PIL import Image
import psutil # For robust process checking

# --- Local imports ---
from backend.app import app, init_db

# --- Configuration ---
HOST = "127.0.0.1"
PORT = 5000
URL = f"http://{HOST}:{PORT}"
APP_NAME = "ChunDiet"

# --- Helper Functions ---

def get_data_dir() -> Path:
    """Returns the path to the application's data directory in AppData/Roaming."""
    data_dir = Path.home() / "AppData" / "Roaming" / APP_NAME
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir

def setup_logging(log_dir: Path):
    """Sets up logging to a file and redirects stdout/stderr."""
    log_file = log_dir / f"{APP_NAME}.log"
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file, mode='w'),
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    class StreamToLogger:
        def __init__(self, logger, level):
            self.logger = logger
            self.level = level
        def write(self, buf):
            for line in buf.rstrip().splitlines():
                self.logger.log(self.level, line.rstrip())
        def flush(self):
            pass

    sys.stdout = StreamToLogger(logging.getLogger(), logging.INFO)
    sys.stderr = StreamToLogger(logging.getLogger(), logging.ERROR)

    def handle_exception(exc_type, exc_value, exc_traceback):
        if issubclass(exc_type, KeyboardInterrupt):
            sys.__excepthook__(exc_type, exc_value, exc_traceback)
            return
        logging.error("Unhandled exception", exc_info=(exc_type, exc_value, exc_traceback))

    sys.excepthook = handle_exception
    logging.info(f"Logging initialized. Log file at: {log_file}")


def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    base_path = getattr(sys, '_MEIPASS', os.path.abspath("."))
    return os.path.join(base_path, relative_path)

# --- Core Application Logic ---

class SingleInstance:
    """
    Ensures only one instance runs using a PID-based lock file.
    Handles stale lock files from crashes.
    """
    def __init__(self, lock_dir):
        self.lock_path = lock_dir / f"{APP_NAME}.lock"
        self.pid = os.getpid()
        self.lock_file_handle = None

    def is_running(self):
        """Check if the PID in the lock file corresponds to a running process."""
        try:
            with open(self.lock_path, 'r') as f:
                pid_in_file = int(f.read())
            
            # Check if a process with this PID exists.
            if psutil.pid_exists(pid_in_file):
                # Optional: Check if the process name is what we expect.
                # This prevents issues if the OS reuses a PID for a new process.
                p = psutil.Process(pid_in_file)
                exe_name = Path(sys.executable).name.lower() # e.g., 'python.exe' or 'chundiet.exe'
                if exe_name in p.name().lower():
                    return True # Process exists and has the right name
            return False # Process doesn't exist, lock is stale
        except (IOError, ValueError, psutil.NoSuchProcess):
            # Lock file is stale, unreadable, or process is gone
            return False

    def __enter__(self):
        if self.is_running():
            logging.warning(f"{APP_NAME} is already running. Exiting new instance.")
            sys.exit(1)
        
        # Create a new lock file with the current PID
        self.lock_file_handle = open(self.lock_path, 'w')
        self.lock_file_handle.write(str(self.pid))
        self.lock_file_handle.flush()
        logging.info(f"Acquired instance lock with PID {self.pid} at {self.lock_path}")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            if self.lock_file_handle:
                self.lock_file_handle.close()
            os.remove(self.lock_path)
            logging.info("Released instance lock.")
        except Exception as e:
            logging.error(f"Failed to release lock file: {e}")


def start_server(data_dir):
    """Initializes the database and starts the Waitress server."""
    try:
        os.chdir(data_dir)
        init_db()
        logging.info(f"Starting Waitress server at {URL}...")
        serve(app, host=HOST, port=PORT, threads=8)
    except Exception:
        logging.error("Failed to start server thread.", exc_info=True)


def open_in_browser():
    webbrowser.open(URL)

def quit_app(icon, item):
    logging.info("Quit command received. Shutting down.")
    icon.stop()

# --- Main Execution Block ---

if __name__ == '__main__':
    data_directory = get_data_dir()
    setup_logging(log_dir=data_directory)
    
    try:
        with SingleInstance(lock_dir=data_directory):
            logging.info(f"--- Starting {APP_NAME} ---")

            server_thread = threading.Thread(target=start_server, args=(data_directory,), daemon=True)
            server_thread.start()
            
            time.sleep(2)
            
            open_in_browser()

            icon_path = resource_path("nah.png")
            icon_image = Image.open(icon_path)
            
            menu = Menu(
                MenuItem('Open ChunDiet', open_in_browser, default=True),
                Menu.SEPARATOR,
                MenuItem('Quit', quit_app)
            )
            
            icon = Icon(APP_NAME, icon_image, f"{APP_NAME} is running", menu=menu)
            
            icon.run()

    except SystemExit as e:
        if e.code != 1: # Don't log the expected exit for "already running"
            logging.error("Application exited with SystemExit.", exc_info=True)
    except Exception:
        logging.error("A critical error occurred in the main execution block.", exc_info=True)
    
    logging.info(f"--- {APP_NAME} Shutdown Complete ---")