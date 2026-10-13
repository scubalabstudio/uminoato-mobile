import { ScrollView } from 'react-native';

import { ComingSoon } from '@/components/ComingSoon';

export default function UnidentifiedTab() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <ComingSoon
        icon="help-circle-outline"
        title="未同定生物"
        description="まだ種が確定していない写真を見て、みんなで同定できます"
      />
    </ScrollView>
  );
}
