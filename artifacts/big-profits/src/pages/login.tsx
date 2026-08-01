*** Begin Patch
*** Update File: artifacts/big-profits/src/pages/login.tsx
@@
 export default function Login() {
@@
   const form = useForm<LoginValues>({
     resolver: zodResolver(loginSchema),
     defaultValues: { email: "", password: "" },
   });
 
   const onSubmit = async (values: LoginValues) => {
@@
-    try {
-      const res = await fetch("/api/auth/login", {
+    try {
+      const API_URL = import.meta.env.VITE_API_URL;
+      const res = await fetch(`${API_URL}/auth/login`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(values),
       });
       const data = await res.json();
*** End Patch
