module.exports = function(temp, param) {
    return temp.calculateBonus("foreach", param).calculateBonus("parameter", param);
}

const strategies = {
    parameter: function(temp, param) {
        return temp.replace(/\{\$(\w*)\}/g, function(math, p1) {
            return param[p1];
        })
    },
    foreach: function(temp, param) {
        return temp.replace(/\{foreach:(\w*)\}([^]*)(?=\{\/foreach\})\{\/foreach\}/g, function(math, p1, p2) {
            let list = "", forParam = param[p1];
            for(let i = 0; i < forParam.length; i++) {
                list += p2.replace(new RegExp(`\\{\\$${p1}\\.(\\w*)\\}`, 'g'), function(math, p1) {
                    return forParam[i][p1];
                })
            }
            return list;
        })
    },
}

String.prototype.calculateBonus = function(type, param) {
    return strategies[type](this, param);
}