import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

export function useAuthStyles() {
  const { isAuthenticated, isLoading } = useAuth();

  /**
   * Returns a class based on authentication status
   * @param authenticatedClass - Class to apply when authenticated
   * @param unauthenticatedClass - Class to apply when not authenticated
   * @returns The appropriate class string
   */
  const authClass = (authenticatedClass: string, unauthenticatedClass: string) => {
    return isAuthenticated ? authenticatedClass : unauthenticatedClass;
  };

  /**
   * Returns multiple classes based on authentication status
   * @param classes - Object with class names as keys and boolean conditions as values
   * @returns Combined class string
   */
  const authClasses = (classes: Record<string, boolean>) => {
    return cn(
      Object.entries(classes).map(([className, condition]) => 
        condition ? className : null
      ).filter(Boolean)
    );
  };

  /**
   * Returns a class that only applies when authenticated
   * @param className - Class to apply when authenticated
   * @returns The class string or empty string
   */
  const whenAuthenticated = (className: string) => {
    return isAuthenticated ? className : "";
  };

  /**
   * Returns a class that only applies when not authenticated
   * @param className - Class to apply when not authenticated
   * @returns The class string or empty string
   */
  const whenUnauthenticated = (className: string) => {
    return !isAuthenticated ? className : "";
  };

  /**
   * Returns a class that only applies when loading
   * @param className - Class to apply when loading
   * @returns The class string or empty string
   */
  const whenLoading = (className: string) => {
    return isLoading ? className : "";
  };

  return { 
    authClass, 
    authClasses, 
    whenAuthenticated, 
    whenUnauthenticated, 
    whenLoading,
    isAuthenticated, 
    isLoading 
  };
} 