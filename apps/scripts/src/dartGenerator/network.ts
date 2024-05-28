import type { Type } from "./trpc.type";
import { getAccessor, getAssignment } from "./util";

export function writeResponseParser(
  output: string | null,
  outputType: Type,
  path: string,
) {
  return `
    if (response.statusCode != 200) {
      throw Exception('Failed to get ${path}: \${response.body}');
    }
    
    ${
      output
        ? `final json = jsonDecode(utf8.decode(response.bodyBytes));
    return ${getAssignment("result']['data']['json", outputType, output, getAccessor("result']['data']['json"))};`
        : ""
    }
  `;
}
