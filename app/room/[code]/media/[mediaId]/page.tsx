import { Suspense } from "react";
import { redirect } from "next/navigation";

/** Media now opens as a modal over the shelf; keep old links working. */
export default function MediaRedirect(props: PageProps<"/room/[code]/media/[mediaId]">) {
  return (
    <Suspense fallback={null}>
      <Redirect params={props.params} />
    </Suspense>
  );
}

async function Redirect({ params }: { params: Promise<{ code: string; mediaId: string }> }): Promise<null> {
  const { code, mediaId } = await params;
  redirect(`/room/${code}?media=${mediaId}`);
  return null;
}
