import type { QueryClient } from "@tanstack/react-query";

export const refreshLearningResults = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ["test-results"] });
  queryClient.invalidateQueries({ queryKey: ["paper-test-results"] });
  queryClient.invalidateQueries({ queryKey: ["my-tests"] });
  queryClient.invalidateQueries({ queryKey: ["dpp-attempts"] });
};