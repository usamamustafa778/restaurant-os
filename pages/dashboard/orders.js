/**
 * Legacy route — /orders and /dashboard/orders redirect to /pos.
 */
export function getServerSideProps({ resolvedUrl }) {
  const queryStart = resolvedUrl.indexOf("?");
  const qs = queryStart >= 0 ? resolvedUrl.slice(queryStart) : "";
  return {
    redirect: {
      destination: `/pos${qs}`,
      permanent: true,
    },
  };
}

export default function OrdersRedirect() {
  return null;
}
