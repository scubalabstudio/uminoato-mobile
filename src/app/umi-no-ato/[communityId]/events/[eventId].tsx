import { Redirect, useLocalSearchParams } from 'expo-router';

export default function EventDeepLink() {
  const { communityId, eventId } = useLocalSearchParams<{ communityId: string; eventId: string }>();
  return <Redirect href={`/${communityId}/events/${eventId}` as never} />;
}
