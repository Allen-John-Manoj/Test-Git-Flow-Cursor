import streamlit as st
import random
import time
from datetime import datetime

st.set_page_config(page_title="Log Simulation", layout="wide")

if 'logs' not in st.session_state:
    st.session_state.logs = []
if 'show_error_options' not in st.session_state:
    st.session_state.show_error_options = False

LOG_MESSAGES = [
    "Processing request from client",
    "Database query executed successfully",
    "User authentication completed",
    "Cache refreshed",
    "File uploaded to storage",
    "API endpoint called",
    "Session initialized",
    "Background job started",
    "Configuration loaded",
    "Health check passed",
    "Memory usage within limits",
    "Connection pool available",
    "Request validated",
    "Response sent to client",
    "Metrics collected",
]

ERROR_OPTIONS = [
    "NullPointerException: Cannot invoke method on null object",
    "ConnectionTimeoutError: Database connection timed out after 30s",
    "OutOfMemoryError: Java heap space exceeded",
    "FileNotFoundException: Config file not found at /etc/app/config.yaml",
    "AuthenticationError: Invalid credentials provided",
    "PermissionDenied: Access to resource forbidden",
]

def generate_log():
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    message = random.choice(LOG_MESSAGES)
    return {"timestamp": timestamp, "message": message, "is_error": False}

def add_error(error_message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    st.session_state.logs.append({
        "timestamp": timestamp,
        "message": error_message,
        "is_error": True
    })

with st.sidebar:
    st.title("Controls")
    
    if st.button("INJECT ERROR", type="primary", use_container_width=True):
        st.session_state.show_error_options = not st.session_state.show_error_options
    
    st.markdown("""
        <style>
        div.stButton > button[kind="primary"] {
            background-color: #ff4444;
            color: white;
            font-weight: bold;
            font-size: 1.2rem;
            padding: 1rem;
            border: none;
            height: 80px;
        }
        div.stButton > button[kind="primary"]:hover {
            background-color: #cc0000;
            color: white;
        }
        </style>
    """, unsafe_allow_html=True)
    
    if st.session_state.show_error_options:
        st.markdown("### Select Error to Inject:")
        for i, error in enumerate(ERROR_OPTIONS):
            if st.button(f"{error[:40]}...", key=f"error_{i}", use_container_width=True):
                add_error(error)
                st.session_state.show_error_options = False
                st.rerun()

st.title("Log Simulation")

col1, col2 = st.columns([2, 1])

with col1:
    st.subheader("Live Logs")
    
    new_log = generate_log()
    st.session_state.logs.append(new_log)
    
    if len(st.session_state.logs) > 100:
        st.session_state.logs = st.session_state.logs[-100:]
    
    log_container = st.container(height=400)
    with log_container:
        for log in reversed(st.session_state.logs):
            if log["is_error"]:
                st.markdown(
                    f'<p style="color: red; font-family: monospace; margin: 2px 0;">'
                    f'[{log["timestamp"]}] ERROR: {log["message"]}</p>',
                    unsafe_allow_html=True
                )
            else:
                st.markdown(
                    f'<p style="color: #00ff00; font-family: monospace; margin: 2px 0;">'
                    f'[{log["timestamp"]}] INFO: {log["message"]}</p>',
                    unsafe_allow_html=True
                )

with col2:
    st.subheader("ERROR DETECTION AND SUGGESTIONS")
    st.markdown(
        '<div style="text-align: center; font-size: 4rem; padding: 2rem;">❌❌❌</div>',
        unsafe_allow_html=True
    )

time.sleep(1)
st.rerun()
