"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { libraryQueryKey } from "./library-api";

export function useLibraryMutation<Input, Output>(
  mutate: (input: Input) => Promise<Output>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutate,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: libraryQueryKey }),
  });
}
