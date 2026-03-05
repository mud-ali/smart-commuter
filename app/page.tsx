"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import Footer from "@/components/Footer";
import SignInButton from "@/components/SignInButton";
import CommuteDisplay from "@/components/CommuteDisplay";

function HomeContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const authParam = searchParams.get("auth");
        const sessionCookie = Cookies.get("smart_commuter_session");

        if (authParam === "success") {
            // 1. Set cookie to expire in 7 days
            Cookies.set("smart_commuter_session", "true", { expires: 7 });
            setIsLoggedIn(true);
            // 2. Clean up URL immediately
            router.replace("/");
        } else if (sessionCookie) {
            setIsLoggedIn(true);
        }
    }, [searchParams, router]);

    const handleLogout = () => {
        Cookies.remove("smart_commuter_session");
        setIsLoggedIn(false);
        router.push("/");
    };

    return (
        <main className="min-h-screen h-full bg-background-hue font-head text-text-hue">
            <div className="content flex flex-col items-center justify-between md:px-32 pt-20 md:pt-24 pb-4">
                <div className="text-center mb-12">
                    <h1 className="text-6xl font-semibold mb-4 font-logo leading-tight">
                        Smart
                        <span className="text-blue-500">
                            <br />
                            &nbsp;&nbsp;Commuter
                        </span>
                    </h1>
                </div>

                <section className="flex flex-col items-center w-full grow">
                    {isLoggedIn ? (
                        <div className="flex flex-col items-center w-full space-y-6">
                            <CommuteDisplay />
                            <button
                                onClick={handleLogout}
                                className="text-xs opacity-50 hover:opacity-100 underline transition-opacity"
                            >
                                Sign out
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center space-y-4">
                            <p className="text-sm mb-2 opacity-50">
                                Sync your schedule to optimize your route
                            </p>
                            <SignInButton />
                        </div>
                    )}
                </section>

                <Footer />
            </div>
        </main>
    );
}

// useSearchParams() requires Suspense in Next.js 13+
export default function Home() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <HomeContent />
        </Suspense>
    );
}
