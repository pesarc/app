"use client";

import { useEffect, useState } from "react";
import { readErc20, type Erc20Snapshot } from "./erc20Read";

type State = {
  loading: boolean;
  data?: Erc20Snapshot;
  error?: string;
};

/** Live ERC-20 balance for an owner; inert until both args are set. */
export function useErc20Balance(
  token?: `0x${string}`,
  owner?: `0x${string}`
): State {
  const [state, setState] = useState<State>({ loading: false });

  useEffect(() => {
    if (!token || !owner) {
      setState({ loading: false });
      return;
    }
    let active = true;
    setState({ loading: true });
    readErc20(token, owner)
      .then((data) => active && setState({ loading: false, data }))
      .catch(
        (e) =>
          active &&
          setState({
            loading: false,
            error: e instanceof Error ? e.message : String(e),
          })
      );
    return () => {
      active = false;
    };
  }, [token, owner]);

  return state;
}
