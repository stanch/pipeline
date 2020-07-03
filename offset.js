const offset = (items, width, gapWidth, groupGapWidth, centerGroupType) => {
    const totalWidth = items =>
        _.sumBy(items, "count") * (width + 2 * gapWidth) +
        (_.size(_.uniqBy(items, "type")) - 1) * groupGapWidth

    const groupCenter = type => {
        const leftAndGroup = _.dropRightWhile(items, item => item.type != type)
        const group = _.filter(items, item => item.type == type)
        return totalWidth(leftAndGroup) - totalWidth(group) / 2
    }

    const itemCenter = item => {
        const leftAndItem = [..._.takeWhile(items, i => !_.isEqual(i, item)), item]
        return totalWidth(leftAndItem) - totalWidth([item]) / 2
    }

    const leftOffset =
        (centerGroupType && _.some(items, item => item.type == centerGroupType)) ?
        -groupCenter(centerGroupType) :
        -totalWidth(items) / 2

    const groupCenterOffset = type => leftOffset + groupCenter(type)

    const itemCenterOffset = item => leftOffset + itemCenter(item)
    const itemLeftOffset = item => itemCenterOffset(item) - totalWidth([item]) / 2
    const itemRightOffset = item => itemCenterOffset(item) + totalWidth([item]) / 2

    // TODO: this does too many passes on the array
    const groups = _.uniqBy(items, "type").map(group => ({
        type: group.type,
        center: groupCenterOffset(group.type),
        items: items.filter(item => item.type == group.type),
        count: _.sumBy(items.filter(item => item.type == group.type), "count")
    }))

    return {
        left: _.isEmpty(items) ? 0 : itemLeftOffset(_.first(items)),
        right: _.isEmpty(items) ? 0 : itemRightOffset(_.last(items)),
        groups,
        itemCenter: itemCenterOffset
    }
}
