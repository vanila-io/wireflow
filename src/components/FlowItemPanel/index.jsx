import { useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { ItemPanel } from 'gg-editor';
import { Card, Empty, Input } from 'antd';
import { RightOutlined } from '@ant-design/icons';

import NodeItem from './NodeItem';
import nodes from './nodesData';
import { groupTemplates } from './groupTemplates';
import './style.css';

// Categories the user collapsed, remembered across reloads.
const COLLAPSED_KEY = 'sidebarCollapsed';

function loadCollapsed() {
  try {
    const value = JSON.parse(localStorage.getItem(COLLAPSED_KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function storeCollapsed(categories) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(categories));
  } catch {
    // Storage unavailable (private mode, quota): keep the state for this session only.
  }
}

const FlowItemPanel = () => {
  const [keyword, setKeyword] = useState('');
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const groups = useMemo(() => groupTemplates(nodes, keyword), [keyword]);
  // While searching, every matching template is shown, even in collapsed categories.
  const searching = keyword.trim() !== '';

  function toggle(button, category) {
    const next = collapsed.includes(category)
      ? collapsed.filter((c) => c !== category)
      : [...collapsed, category];
    storeCollapsed(next);
    // Collapsing the category you have scrolled into would leave its pinned heading far
    // above the visible list. Apply the change now and bring the heading back into view.
    flushSync(() => setCollapsed(next));
    button.scrollIntoView({ block: 'nearest' });
  }

  return (
    <ItemPanel className='sidebar-wrapper'>
      <Card className='sidebar' styles={{ body: { padding: 0 } }}>
        <Input.Search
          className='sidebar-search'
          placeholder='Search'
          allowClear
          size='small'
          onChange={(e) => setKeyword(e.target.value)}
        />
        <div className='sidebar-list'>
          {groups.map(({ category, items }) => {
            const expanded = searching || !collapsed.includes(category);
            const id = `sidebar-category-${category.replace(/\W+/g, '-')}`;

            return (
              <section key={category} className='sidebar-category'>
                <h2 className='sidebar-category-heading'>
                  <button
                    type='button'
                    className='sidebar-category-toggle'
                    aria-expanded={expanded}
                    // Collapsed categories render no list, so there is nothing to point at.
                    aria-controls={expanded ? id : undefined}
                    disabled={searching}
                    onClick={(e) => toggle(e.currentTarget, category)}
                  >
                    <RightOutlined className='sidebar-category-caret' aria-hidden />
                    <span className='sidebar-category-name'>{category}</span>
                    <span className='sidebar-category-count'>{items.length}</span>
                  </button>
                </h2>
                {expanded && (
                  <div id={id}>
                    {items.map((item, i) => (
                      <NodeItem key={i} {...item} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {groups.length === 0 && (
            <Empty
              className='sidebar-empty'
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description='No matching templates'
            />
          )}
        </div>
      </Card>
    </ItemPanel>
  );
};

export default FlowItemPanel;
