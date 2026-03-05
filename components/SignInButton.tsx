export default function SignInButton() {
    const handleLogin = () => {
        // Redirects to your Express server's auth endpoint
        window.location.href = "http://localhost:8080/auth";
    };

    return (
        <button
            onClick={handleLogin}
            className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-all shadow-lg"
        >
            Connect Google Calendar
        </button>
    );
}