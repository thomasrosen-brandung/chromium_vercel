/**
 * @param {import("puppeteer").Page} page
 */
function getClient(page) {
  return /** @type {import('puppeteer').CDPSession} */ /** @type {any} */ page._client()
}

/**
 * @param {import("puppeteer").CDPSession} client
 */
async function getAccessibilityTree(client) {
  return /** @type {import("puppeteer/lib/esm/protocol").default.Accessibility.getFullAXTreeReturnValue} */ await client.send(
    'Accessibility.getFullAXTree'
  )
}

/**
 * @param {import("puppeteer").Frame} frame
 * @param {number} backendNodeId
 */
async function resolveNodeFromBackendNodeId(frame, backendNodeId) {
  const ctx = await Promise.resolve(frame.executionContext())
  return /** @type {import('puppeteer').ElementHandle} */ /** @type {any} */ ctx._adoptBackendNodeId(
    backendNodeId
  )
}
// usage:
// const node = await resolveNodeFromBackendNodeId(page.mainFrame(), backendDOMNodeId)

function simplifyTree(node) {
  const role = node.role?.value
  const name = node.name?.value

  if (!role || role === 'none' || !name || name === '') {
    return {
      hasContent: false,
      nodeId: node.nodeId,
      childIds: node.childIds,
    }
  }

  return {
    hasContent: true,
    nodeId: node.nodeId,
    childIds: node.childIds,
    role: node.role?.value,
    name: node.name?.value,
    // properties: node.properties,
    // children: node.children?.map((child) => simplifyTree(child)),
    value: node.value,
  }
}

function getChildNodes(tree, node) {
  const children = node.childIds?.map((childId) => {
    const child = tree.find((node) => node.nodeId === childId)
    tree = tree.filter((node) => node.nodeId !== childId)
    return child
  })

  return {
    tree,
    children
  }
}

export async function simplifyHtml(page) {
  // await page.content()

  const client = await getClient(page)
  let tree = (await getAccessibilityTree(client)).nodes

  console.log('tree', tree)

  for (let i = 0; i < tree.length; i++) {
    tree[i] = simplifyTree(tree[i])
  }
  console.log('tree', tree)

  tree = tree.map((node) => {
    const { tree: new_tree, children } = getChildNodes(tree, node)
    tree = new_tree

    return {
      ...node,
      children,
    }
  })

  // tree = tree.filter(Boolean)

  return tree // JSON.stringify(tree, null, 2)

  return await page.content()
}
