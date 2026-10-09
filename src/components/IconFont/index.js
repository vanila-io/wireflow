import { createFromIconfontCN } from '@ant-design/icons';
// The project's iconfont.cn symbol script (font_1794059_wia34skss5b.js), vendored
// so the toolbar icons ship with the build and work offline instead of loading
// from at.alicdn.com.
import scriptUrl from './iconfont.js?url';

const IconFont = createFromIconfontCN({ scriptUrl });

export default IconFont;
